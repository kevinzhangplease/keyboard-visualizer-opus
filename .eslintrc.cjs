/* ESLint: TypeScript + a hard ban on Math.random (§4.2 — all randomness is seeded). */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { browser: true, es2020: true, node: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-restricted-properties': [
      'error',
      {
        object: 'Math',
        property: 'random',
        message: 'Use the seeded PRNG (core/prng.ts). Math.random() is banned (§4.2).',
      },
    ],
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts'],
};
