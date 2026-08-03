/**
 * ESLint の設定。
 *
 * 目的は「動かなくなる書き間違い」を機械的に見つけること。
 * 見た目の好み（引用符・セミコロン・インデント）は対象にしない。
 *
 * とくに no-undef が重要。App.jsx を複数ファイルへ分けたとき、
 * import を書き忘れても Vite のビルドは通ってしまい、
 * 実際にその機能を使ったときに初めて壊れる。ここで止める。
 */
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: ['dist/**', 'dev-dist/**', 'public/vendor/**', 'node_modules/**', '.assets-original/**'],
    },
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                // public/vendor/ から読み込むライブラリはグローバルに生える
                fabric: 'readonly',
                pdfjsLib: 'readonly',
                idbKeyval: 'readonly',
                jsQR: 'readonly',
                Peer: 'readonly',
                QRCode: 'readonly',
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: { react, 'react-hooks': reactHooks },
        settings: { react: { version: 'detect' } },
        rules: {
            ...js.configs.recommended.rules,
            'react-hooks/rules-of-hooks': 'error',

            // JSX の中で使われている名前を「使用済み」と数えるために必要。
            // これが無いと <Header /> のような使い方が検出されず、
            // 本当は必要な import まで「未使用」と報告されてしまう。
            'react/jsx-uses-vars': 'error',
            'react/jsx-uses-react': 'error',

            // import 忘れ・タイプミスを確実に捕まえる
            'no-undef': 'error',

            // 使っていない import が残っていると、分割の取りこぼしに気づけない
            'no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
                varsIgnorePattern: '^React$',
            }],

            // 見た目の好みは対象にしない
            'no-empty': 'off',
            'no-console': 'off',
        },
    },
    {
        files: ['scripts/**/*.mjs', 'eslint.config.js', '*.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.serviceworker },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'no-empty': 'off',
        },
    },
];
