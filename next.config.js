/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ant-design/icons-svg'],
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

    // Add support for ant-design icons
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ant-design/icons/lib/dist$': '@ant-design/icons/lib/index.js',
    };

    return config;
  },
};

module.exports = nextConfig;
