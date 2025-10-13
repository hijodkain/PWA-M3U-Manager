/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Web Worker support
    config.module.rules.push({
      test: /\.worker\.ts$/,
      loader: 'worker-loader',
      options: {
        filename: 'static/[hash].worker.js',
        publicPath: '/_next/',
      },
    });

    // Fix for worker-loader in Next.js
    if (!isServer) {
      config.output.globalObject = 'self';
    }

    return config;
  },
};

module.exports = nextConfig;
