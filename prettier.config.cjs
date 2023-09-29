/** @type {import('prettier').Config} */
module.exports = {
  arrowParens: 'always',
  printWidth: 100,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',

  importOrder: ['<THIRD_PARTY_MODULES>', '^[./]'],

  importOrderSeparation: true,
  importOrderSortSpecifiers: true,

  plugins: ['@trivago/prettier-plugin-sort-imports'],
};
