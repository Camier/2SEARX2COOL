module.exports = {
  // TypeScript files
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc --noEmit'
  ],
  
  // JavaScript files
  '*.{js,jsx}': [
    'eslint --fix',
    'prettier --write'
  ],
  
  // Style files
  '*.{css,scss,sass}': [
    'stylelint --fix',
    'prettier --write'
  ],
  
  // JSON, YAML, Markdown
  '*.{json,yml,yaml,md}': [
    'prettier --write'
  ],
  
  // Python files (for engines)
  '*.py': [
    'black',
    'flake8'
  ]
};