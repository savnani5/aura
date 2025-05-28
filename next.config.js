/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  images: {
    formats: ['image/webp'],
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Important: return the modified config
    config.module.rules.push({
      test: /\.mjs$/,
      enforce: 'pre',
      use: ['source-map-loader'],
      exclude: /@mediapipe/,
    });

    // Ignore source map warnings for MediaPipe
    config.ignoreWarnings = [
      { module: /@mediapipe/ },
      { message: /Failed to parse source map/ },
    ];

    return config;
  },
};

module.exports = nextConfig;
