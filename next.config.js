/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Web Workers are natively supported in Next.js 14+ with new Worker(new URL(...))
    // No need for worker-loader anymore

    // ESM modules fix
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };

    return config;
  },
};

module.exports = nextConfig;
