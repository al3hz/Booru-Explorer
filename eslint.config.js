import globals from "globals";
import pluginJs from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: ["dist/"],
  },

  // === JS/TS files (including .vue script blocks) ===
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // === Vue SFC files — use vue-eslint-parser with TS for script blocks ===
  {
    files: ["**/*.vue"],
    languageOptions: {
      globals: globals.browser,
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: "module",
      },
    },
  },

  // === Node files ===
  {
    files: ["vite.config.js", "api/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Base recommended rules (JS only)
  pluginJs.configs.recommended,

  // Vue recommended rules
  ...pluginVue.configs["flat/recommended"],

  // TypeScript recommended rules (only for non-Vue files)
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{js,mjs,cjs,ts}"],
  })),

  // Custom overrides
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
