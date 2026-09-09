import { config } from 'dotenv';
import type { NextConfig } from 'next';

/**
 * The repo keeps one .env at its root, and Next only looks inside web/. Bridge
 * them rather than duplicating secrets into a second file. In a deployment the
 * platform supplies these directly and this call finds nothing, which is fine.
 */
config({ path: '../.env' });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** @assay/config is TypeScript source, shared with the scripts and worker. */
  transpilePackages: ['@assay/config'],
  /**
   * Keep ethers out of the server bundle.
   *
   * Next patches global fetch for its own caching, and ethers builds on fetch.
   * Bundled, every RPC call timed out — three retries at 120s each — while the
   * identical request over curl returned in 8s. Left external, ethers uses the
   * runtime's own fetch and behaves.
   */
  serverExternalPackages: ['ethers'],
};

export default nextConfig;
