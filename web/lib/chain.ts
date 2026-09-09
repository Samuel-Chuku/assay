import 'server-only';

import { ethers } from 'ethers';

import { CREDITCOIN, SEPOLIA } from '@assay/config/chains';
import { useFetchTransport } from './rpc-transport';

/**
 * Providers for both chains, in one place.
 *
 * Every reader goes through here so the fetch transport is registered before
 * any provider exists — ethers' own `node:https` transport aborts at ~5s in
 * this environment no matter what timeout is configured.
 */

/**
 * Free testnet endpoints are slow and variable: the same `eth_getLogs` has been
 * seen at 2.6s and at 15.5s within an hour.
 */
const RPC_TIMEOUT_MS = 120_000;

function endpoint(url: string): ethers.FetchRequest {
  const request = new ethers.FetchRequest(url);
  request.timeout = RPC_TIMEOUT_MS;
  return request;
}

export function creditcoin(): ethers.JsonRpcProvider {
  useFetchTransport();
  return new ethers.JsonRpcProvider(
    endpoint(CREDITCOIN.rpcUrl),
    ethers.Network.from(CREDITCOIN.chainId),
    { staticNetwork: true }
  );
}

export function sepolia(): ethers.JsonRpcProvider {
  useFetchTransport();
  if (!SEPOLIA.rpcUrl.trim()) {
    throw new Error('SOURCE_CHAIN_RPC_URL is not set, so source transactions cannot be resolved.');
  }
  return new ethers.JsonRpcProvider(
    endpoint(SEPOLIA.rpcUrl),
    ethers.Network.from(SEPOLIA.chainId),
    { staticNetwork: true }
  );
}

/**
 * These endpoints fail intermittently rather than staying down, so one retry
 * turns most failures into a slow success.
 */
export async function retry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(
    `${label} failed after ${attempts} attempts: ${last instanceof Error ? last.message : String(last)}`
  );
}
