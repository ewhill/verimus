import typescriptEslintParser from "@typescript-eslint/parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";

export default [
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: typescriptEslintParser,
            parserOptions: {
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslintPlugin,
            "import": importPlugin,
        },
        rules: {
            "@typescript-eslint/no-var-requires": "error",
            "import/order": [
                "error",
                {
                    "groups": ["builtin", "external", "internal"],
                    "newlines-between": "always",
                    "alphabetize": {
                        "order": "asc",
                        "caseInsensitive": true
                    }
                }
            ]
        }
    }
];
