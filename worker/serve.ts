/**
 * The watcher's read-only status server.
 *
 * Two endpoints, no writes, no secrets in any response.
 *
 *   GET /health         is the watcher alive, and how far behind is it
 *   GET /verdicts.json  the latest verdict per agent, as the watcher holds them
 *
 * `/verdicts.json` exists because the site is deployed from git while judgments
 * are formed here. Without it the site shows whatever verdict was committed at
 * deploy time, forever, and the claim that the system runs on its own quietly
 * stops being true.
 *
 * Nothing here is authoritative. Every field a reader could act on is checkable
 * against the chain: a verdict's `reasoningHash` is bound into its on-chain
 * offer, so a consumer that recomputes keccak256 over the reasoning proves the
 * text came from the decision the contract was given. That is what makes it safe
 * to serve this over a link the reader does not control.
 *
 * Binds to loopback only. Exposing it is the reverse proxy's job.
 */
import { createServer, type Server } from 'node:http';

import { WATCHER } from '../config/watcher';
import { collectVerdicts } from '../underwriter/exported';

export type WatcherHealth = {
  startedAt: string;
  lastTickAt: string | null;
  lastScannedBlock: number;
  pending: number;
  proofsToday: number;
  proofCeiling: number;
  consecutiveFailures: number;
};

/**
 * Starts the status server. Returns null when the port is already taken, which
 * must not be fatal: the watcher's job is proving events, and it should keep
 * doing that even if nothing can read its status.
 */
export function serveStatus(health: () => WatcherHealth): Server | null {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    // Read-only by construction.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }

    const send = (status: number, body: unknown) => {
      const text = `${JSON.stringify(body, null, 2)}\n`;
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        // The consumer is a server-side render on its own revalidate cycle.
        // Anything longer here would just add a second staleness window.
        'cache-control': 'public, max-age=15',
        'access-control-allow-origin': '*',
      });
      res.end(req.method === 'HEAD' ? undefined : text);
    };

    try {
      if (url.pathname === '/health') {
        const now = health();
        send(200, { status: 'ok', ...now });
        return;
      }

      if (url.pathname === '/verdicts.json') {
        send(200, collectVerdicts());
        return;
      }

      send(404, { error: 'not found', endpoints: ['/health', '/verdicts.json'] });
    } catch (cause) {
      // A missing or unreadable verdict log is a real failure, and saying so is
      // better than serving an empty list that a reader would treat as "no
      // agents were ever judged".
      send(503, { error: cause instanceof Error ? cause.message : String(cause) });
    }
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(
      `  status server not started (${error.code ?? error.message}); the watcher continues`
    );
  });

  server.listen(WATCHER.statusPort, '127.0.0.1', () => {
    console.log(`  status server on 127.0.0.1:${WATCHER.statusPort} (/health, /verdicts.json)`);
  });

  return server;
}
