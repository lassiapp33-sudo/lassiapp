const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  ...compat.extends('expo', 'prettier'),
  {
    plugins: {
      prettier: require('eslint-plugin-prettier'),
    },
    rules: {
      // Prettier comme avertissement (pas erreur bloquante)
      'prettier/prettier':   'warn',
      // Props React — non pertinent en TypeScript strict
      'react/display-name': 'off',
      'react/prop-types':   'off',
      // Logs — warn pour console.log (warn/error autorisés dans le logger)
      'no-console':         ['warn', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'supabase/**',
      'ngrok-localtunnel-shim/**',
      'src/global-polyfills.js',
    ],
  },
];
