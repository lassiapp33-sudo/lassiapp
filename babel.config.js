// Plugin inline qui remplace import.meta.env par {"MODE":"production"}
// Metro ne transforme pas import.meta (syntaxe ES modules) et le code
// de Zustand devtools en dépend — ce plugin corrige ça à la compilation.
const importMetaEnvPlugin = () => ({
  visitor: {
    MetaProperty(nodePath) {
      if (
        nodePath.node.meta.name === 'import' &&
        nodePath.node.property.name === 'meta'
      ) {
        nodePath.replaceWithSourceString('({"env":{"MODE":"production"}})');
      }
    },
  },
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [importMetaEnvPlugin],
  };
};
