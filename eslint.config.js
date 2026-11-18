import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-native/**",
      "**/build/**",
      "**/.gradle/**",
      "**/src/main/assets/**",
      "apps/mobile/ios/App/App/public/**",
      "design/**",
      "**/node_modules/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
