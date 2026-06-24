import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Flat config (ESLint 9). Tuned for an existing codebase: real correctness
// problems are errors; stylistic / legacy-debt items are warnings so the lint
// step is informative without being a wall of red. Tighten over time.
export default [
  {
    // .ts/.tsx are type-checked via `npm run typecheck` (tsc); ESLint stays
    // JS-only until typescript-eslint is wired in, so it never tries to parse
    // TS syntax with the JS parser.
    ignores: ["dist/**", "node_modules/**", "dev-dist/**", "public/**", "**/*.min.js", "**/*.ts", "**/*.tsx"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off", // Vite/React 17+ JSX transform
      "react/prop-types": "off", // project doesn't use prop-types
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "error", // genuine bug class
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["warn", { checkLoops: false }],
      // Stylistic / low-risk legacy debt → warnings (ratchet to error later).
      // `no-undef` stays an error: it catches real ReferenceError bugs.
      "no-useless-escape": "warn",
      "no-constant-binary-expression": "warn",
      "no-async-promise-executor": "warn",
      "no-prototype-builtins": "warn",
    },
  },
  // Node-side scripts/servers
  {
    files: ["server.js", "*.config.js", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  // Test files
  {
    files: ["src/**/*.{test,spec}.{js,jsx}", "src/test/**"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
];
