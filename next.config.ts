import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker イメージを小さくするため standalone 出力を使う
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
};

export default nextConfig;
