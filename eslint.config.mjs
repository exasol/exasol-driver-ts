import js from "@eslint/js";
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
        ignores: ["coverage/**", "coverage-browser/**", "dist/**"],
    }, {
        plugins: {
            jest,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },

            parser: tseslint.parser,
            ecmaVersion: "latest",
            sourceType: "module",
        },

        rules: {},
    }]);
