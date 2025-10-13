/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@ant-design/icons-svg',
    '@ant-design/icons',
    'rc-util',
    'rc-pagination',
    'rc-picker',
    'rc-table',
    'rc-tree',
    'antd'
  ],
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

    // Add support for ant-design icons and rc-util
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ant-design/icons/lib/dist$': '@ant-design/icons/lib/index.js',
      'rc-util/es/Dom/canUseDom': 'rc-util/lib/Dom/canUseDom',
    };

    // ESM modules fix
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };

    return config;
  },
};

module.exports = nextConfig;
