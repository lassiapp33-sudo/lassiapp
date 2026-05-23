const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-reanimated v4 expose du TypeScript brut dans son champ
// "react-native" (src/index.ts). Metro ne peut pas transformer ce fichier
// depuis node_modules. On redirige vers les fichiers JS compilés (lib/module).
const REAN_COMPILED = require.resolve(
  './node_modules/react-native-reanimated/lib/module/index.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-reanimated') {
    return { filePath: REAN_COMPILED, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
