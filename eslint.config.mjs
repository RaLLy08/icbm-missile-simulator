import globals from 'globals';
import pluginJs from '@eslint/js';
// import tseslint from "typescript-eslint";
import pluginReact from 'eslint-plugin-react';

export default [
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], ignores: ['.config/*'] },
  { languageOptions: { globals: globals.browser } },
  { ...pluginJs.configs.recommended, ignorePatterns: ['*.config/*'] },
  // ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
];
