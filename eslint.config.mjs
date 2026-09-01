import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jest from "eslint-plugin-jest";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from 'typescript-eslint';

export default defineConfig([
    //js.configs.all,
    js.configs.recommended,
    tseslint.configs.recommended,
    //tseslint.configs.strict,
    //tseslint.configs.stylistic,
    {
        ignores: ["coverage/**", "dist/**"],
    }, {
        plugins: {
            "@typescript-eslint": typescriptEslint,
            jest,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },

            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
        },

        rules: {},
    }]);
