const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ── Polyfills injectés AVANT tout module (avant même index.ts) ────────────────
// DOMException est utilisé par expo/virtual/streams.js pendant l'init du bundle.
// La seule façon fiable de l'intercepter est via polyfillModuleNames.
config.serializer.polyfillModuleNames = [
  ...config.serializer.polyfillModuleNames,
  path.resolve(__dirname, 'src/global-polyfills.js'),
];

module.exports = config;
