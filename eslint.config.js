const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  ...compat.extends('expo', 'prettier'),
  {
    plugins: {
      prettier:      require('eslint-plugin-prettier'),
      'react-hooks': require('eslint-plugin-react-hooks'),
    },
    rules: {
      // Prettier comme avertissement
      'prettier/prettier':   'warn',
      // Props React — non pertinent en TypeScript strict
      'react/display-name': 'off',
      'react/prop-types':   'off',
      // Logs — warn pour console.log (warn/error autorisés dans le logger)
      'no-console':         ['warn', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'warn',

      // ── React Compiler (expérimental, non activé dans ce projet) ──────────
      // Ces règles vérifient la compatibilité avec le futur React Compiler.
      // Elles génèrent des faux positifs sur des patterns React Native valides.
      'react-compiler/react-compiler':         'off',
      'react-hooks/purity':                    'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components':         'off',
      'react-hooks/invariant':                 'off',
      'react-hooks/immutability':              'off',
      'react-hooks/globals':                   'off',
      'react-hooks/capitalized-calls':         'off',
      'react-hooks/hooks':                     'off',
      // Patterns React Native légitimes flagués par react-hooks
      // useRef(new Animated.Value()).current — API officielle RN Animated
      'react-hooks/refs':                      'warn',
      // setState dans useEffect pour reset sur changement de prop — pattern valide
      'react-hooks/set-state-in-effect':       'warn',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'supabase/**',
      'ngrok-localtunnel-shim/**',
      'src/global-polyfills.js',  // polyfills intentionnels en var
    ],
  },
];
