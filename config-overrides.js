module.exports = function override(config) {
  // Stub out Node.js built-ins that face-api.js references
  // but are not needed in a browser environment
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    path: false,
    os: false,
    crypto: false,
  };
  return config;
};
