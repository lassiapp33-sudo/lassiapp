const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ── Polyfills injectés AVANT tout module (avant même index.ts) ────────────────
config.serializer.polyfillModuleNames = [
  ...config.serializer.polyfillModuleNames,
  path.resolve(__dirname, 'src/global-polyfills.js'),
];

// ── Forcer Zustand vers CJS sur web (évite import.meta dans les ESM) ──────────
// Zustand exporte ./esm/*.mjs (avec import.meta) quand Metro résout avec la
// condition "import". Les fichiers CJS (.js) n'ont pas ce problème.
const zustandDir = path.resolve(__dirname, 'node_modules/zustand');
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Redirect zustand/* imports to their CJS equivalents
    if (moduleName === 'zustand' || moduleName === 'zustand/') {
      return { filePath: path.join(zustandDir, 'index.js'), type: 'sourceFile' };
    }
    if (moduleName === 'zustand/middleware') {
      return { filePath: path.join(zustandDir, 'middleware.js'), type: 'sourceFile' };
    }
    if (moduleName === 'zustand/react') {
      return { filePath: path.join(zustandDir, 'react.js'), type: 'sourceFile' };
    }
    if (moduleName === 'zustand/shallow') {
      return { filePath: path.join(zustandDir, 'shallow.js'), type: 'sourceFile' };
    }
    // Intercepter aussi les imports depuis les fichiers ESM de zustand
    if (
      context.originModulePath.includes(`node_modules${path.sep}zustand${path.sep}esm`) ||
      context.originModulePath.includes('node_modules/zustand/esm')
    ) {
      const base = moduleName.replace(/^\.\//, '').replace(/\.mjs$/, '');
      const cjsPath = path.join(zustandDir, base + '.js');
      try {
        require.resolve(cjsPath);
        return { filePath: cjsPath, type: 'sourceFile' };
      } catch (_) {}
    }
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
