import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.wapp_cache/**', '**/.wapp_build/**', '**/coverage/**', '**/*.js.map', '**/*.tsbuildinfo', '**/*.ts'],
  },
  {
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-duplicate-imports': 'warn',
    },
  },
];
