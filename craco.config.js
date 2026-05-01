module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Stub out Node.js built-ins that face-api.js references
      // but are not needed in a browser environment
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
      return webpackConfig;
    },
  },
};
