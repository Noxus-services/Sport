import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Set basePath only for GitHub Pages (env var injected in CI)
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
