/**
 * Phase 0 acceptance: both chains reachable and correct, the block-prover
 * precompile present, the Proof Builder answering, the attestor network alive,
 * both registries real, and the deployer funded on both chains.
 *
 * adapted-from-examples: shared/check_setup.ts — the pass/fail reporting shape
 * and the precompile probe technique. Rewritten, not imported.
 *
 * T11: run through tsx so dotenv loads .env. Do not try to source it in fish.
 */
import 'dotenv/config';

import { ethers } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';

import { CREDITCOIN, SEPOLIA, REGISTRIES, TRUSTED_EMITTERS } from '../config/chains';

type Check = { ok: boolean; message: string };

const pass = (message: string): Check => ({ ok: true, message });
const fail = (message: string): Check => ({ ok: false, message });

/** ethers reports an on-chain revert as CALL_EXCEPTION; anything else is transport. */
function isRevert(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'CALL_EXCEPTION';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function checkRpc(label: string, url: string, expectedChainId: number): Promise<Check> {
  if (!url.trim()) return fail(`${label}: not set`);
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const network = await provider.getNetwork();
    const block = await provider.getBlockNumber();
    const actual = Number(network.chainId);
    if (actual !== expectedChainId) {
      return fail(`${label}: wrong chain, expected ${expectedChainId}, got ${actual}`);
    }
    return pass(`${label}: chainId ${actual}, head block ${block}`);
  } catch (error) {
    return fail(`${label}: unreachable (${describe(error)})`);
  }
}

/**
 * Frontier precompiles are runtime PrecompileSet entries, not accounts holding
 * bytecode, so getCode returns '0x' even when the precompile is present and
 * working. Probe instead: an empty call reverts on the absent selector when
 * something is there, and returns '0x' when the address is empty.
 */
async function checkPrecompile(): Promise<Check> {
  try {
    const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
    const result = await provider.call({ to: CREDITCOIN.blockProverPrecompile, data: '0x' });
    return fail(`BlockProver 0x0FD2: nothing there, call returned ${result} (wrong network?)`);
  } catch (error) {
    if (isRevert(error)) return pass('BlockProver 0x0FD2: present');
    return fail(`BlockProver 0x0FD2: check failed (${describe(error)})`);
  }
}

async function checkProofBuilder(): Promise<Check> {
  try {
    const response = await fetch(CREDITCOIN.proofBuilderUrl.replace(/\/$/, ''), { method: 'GET' });
    if (response.ok || response.status === 404 || response.status === 405) {
      return pass(`Proof Builder: responding (HTTP ${response.status})`);
    }
    return fail(`Proof Builder: HTTP ${response.status}`);
  } catch (error) {
    return fail(`Proof Builder: unreachable (${describe(error)})`);
  }
}

/**
 * How far the attestor network has got on Sepolia. This is the primitive behind
 * both the T3 worker wait and the fail-closed freeze trigger, so a green line
 * here means more than reachability.
 */
async function checkAttestation(): Promise<Check> {
  try {
    const provider = new ethers.JsonRpcProvider(CREDITCOIN.rpcUrl);
    const info = new chainInfo.PrecompileChainInfoProvider(provider);
    const latest = await info.getLatestAttestedHeightAndHash(SEPOLIA.sourceChainKey);
    return pass(`Attestation, chain key ${SEPOLIA.sourceChainKey}: latest attested height ${latest.height}`);
  } catch (error) {
    return fail(`Attestation: failed (${describe(error)})`);
  }
}

/**
 * The two registry addresses are the entire security model (T5). A typo here
 * would not fail loudly later, it would silently trust nothing or the wrong
 * thing, so confirm both are real contracts on Sepolia.
 */
async function checkRegistries(): Promise<Check[]> {
  if (!SEPOLIA.rpcUrl.trim()) {
    return [fail('Registries: skipped, no SOURCE_CHAIN_RPC_URL')];
  }
  const provider = new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
  const named: [string, string][] = [
    ['Identity Registry', REGISTRIES.identity],
    ['Reputation Registry', REGISTRIES.reputation],
  ];
  const results: Check[] = [];
  for (const [label, address] of named) {
    try {
      const code = await provider.getCode(address);
      results.push(
        code && code !== '0x'
          ? pass(`${label}: contract at ${address} (${(code.length - 2) / 2} bytes)`)
          : fail(`${label}: no code at ${address}`)
      );
    } catch (error) {
      results.push(fail(`${label}: check failed (${describe(error)})`));
    }
  }
  results.push(pass(`Trusted emitters: ${TRUSTED_EMITTERS.length} hardcoded`));
  return results;
}

async function checkBalance(label: string, rpcUrl: string, address: string, symbol: string): Promise<Check> {
  if (!rpcUrl.trim()) return fail(`${label}: skipped, no RPC URL`);
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(address);
    const formatted = ethers.formatEther(balance);
    if (balance === 0n) return fail(`${label}: 0 ${symbol}, needs funding`);
    return pass(`${label}: ${formatted} ${symbol}`);
  } catch (error) {
    return fail(`${label}: check failed (${describe(error)})`);
  }
}

async function main(): Promise<void> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  const results: Check[] = [];

  results.push(await checkRpc('Creditcoin RPC', CREDITCOIN.rpcUrl, CREDITCOIN.chainId));
  results.push(await checkRpc('Sepolia RPC   ', SEPOLIA.rpcUrl, SEPOLIA.chainId));
  results.push(await checkPrecompile());
  results.push(await checkProofBuilder());
  results.push(await checkAttestation());
  results.push(...(await checkRegistries()));

  if (!key?.trim()) {
    results.push(fail('DEPLOYER_PRIVATE_KEY: not set, balance checks skipped'));
  } else {
    let deployer: string;
    try {
      deployer = new ethers.Wallet(key).address;
    } catch {
      results.push(fail('DEPLOYER_PRIVATE_KEY: not a valid private key'));
      report(results);
      return;
    }
    results.push(pass(`Deployer: ${deployer}`));
    results.push(await checkBalance('Deployer on Creditcoin', CREDITCOIN.rpcUrl, deployer, CREDITCOIN.currency));
    results.push(await checkBalance('Deployer on Sepolia   ', SEPOLIA.rpcUrl, deployer, 'ETH'));
  }

  report(results);
}

function report(results: Check[]): void {
  for (const result of results) {
    console.log(`${result.ok ? '✓' : '✗'} ${result.message}`);
  }
  const failures = results.filter((r) => !r.ok).length;
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed. Fix, then re-run: pnpm check:chain`);
    process.exit(1);
  }
  console.log('\nPhase 0 foundations green.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
