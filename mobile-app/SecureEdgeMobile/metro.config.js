const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: Array.from(
      new Set([...defaultConfig.resolver.assetExts, 'tflite']),
    ),
    blockList: /android\/.*/,
  },
};

module.exports = mergeConfig(defaultConfig, config);
