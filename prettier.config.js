module.exports = {
  tabWidth: 4,
  printWidth: 120,
  proseWrap: 'preserve',
  useTabs: false,
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  overrides: [
    {
      files: '{*.js?(on),*.md,.prettierrc,.babelrc}',
      options: {
        tabWidth: 2,
      },
    },
  ],
};
