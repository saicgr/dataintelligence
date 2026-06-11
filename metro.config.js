// Expo Metro config. Registers `.wasm` as an asset so expo-sqlite's web build
// (wa-sqlite/wa-sqlite.wasm) resolves — otherwise the web bundle fails to build.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
