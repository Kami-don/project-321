module.exports = {
  plugins: ['cypress'],
  env: {
    'cypress/globals': true,
  },
  extends: ['plugin:cypress/recommended'],
  rules: {
    // Allowing Array.from
    'no-restricted-syntax': 'off',

    // not using jest expects
    'jest/expect-expect': 'off',
  },
};
