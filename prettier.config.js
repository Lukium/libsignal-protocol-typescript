module.exports = {
  tabWidth: 4,
  printWidth: 120,
  proseWrap: 'preserve',
  useTabs: false,
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  // Respect each file's existing line endings so lint/format don't fail on
  // CRLF working trees (Windows checkouts) — this repo has no .gitattributes
  // enforcing LF, so 'auto' avoids spurious end-of-line lint errors.
  endOfLine: 'auto',
  overrides: [
    {
      files: '{*.js?(on),*.md,.prettierrc,.babelrc}',
      options: {
        tabWidth: 2,
      },
    },
  ],
};
