import { ethers } from 'ethers';

/**
 * Route ethers' RPC calls through `fetch` instead of `node:https`.
 *
 * ethers talks to a node through `node:https` directly. In this environment
 * that transport aborts every request at almost exactly 5s regardless of the
 * configured timeout — `FetchRequest.timeout` was verified as 120000 and the
 * failure still landed at 5013ms — while `curl` and Node's own `fetch` reached
 * the identical endpoint in seconds. So the transport was the fault, not the
 * endpoint, the timeout, or the bundler.
 *
 * Measured after switching: block number in 1.0s, and twelve proof logs in
 * 6.2s, on calls that had been failing three times over.
 *
 * This also matches how the app runs when deployed, where `fetch` is the
 * native transport anyway.
 */
let registered = false;

export function useFetchTransport(): void {
  if (registered) return;
  registered = true;

  ethers.FetchRequest.registerGetUrl(async (req: ethers.FetchRequest) => {
    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body ? Buffer.from(req.body) : undefined,
      signal: AbortSignal.timeout(req.timeout),
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      statusCode: response.status,
      statusMessage: response.statusText,
      headers,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  });
}
