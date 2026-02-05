import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import jsdoc from 'eslint-plugin-jsdoc';

export default defineConfig([
	{ files: ['**/*.{js,mjs,cjs,vue}'] },

	{
		files: ['**/*.{js,mjs,cjs,vue}'],
		languageOptions: { globals: globals.browser }
	},

	{
		files: ['**/*.{js,mjs,cjs,vue}'],
		plugins: { js },
		extends: ['js/recommended']
	},

	pluginVue.configs['flat/essential'],

	{
		plugins: {
			jsdoc: jsdoc,
		},
		
		rules: {
			// console.log などを使うと警告
			'no-console': ['warn'],  
			 // セミコロンを強制
			'semi': ['error', 'always'],
			// シングルクォートを強制
			'quotes': ['error', 'single'], 
			// tabのインデントを注意
			'indent': [1, 'tab'],  
			// キャメルケースを強制
			'camelcase': ['error', { 'properties': 'always' }], 
			//カンマの後に空白を強制
			'comma-spacing': ['error', { before: false, after: true }], 
			// 厳密等価演算子を強制
			'eqeqeq': ['error', 'always'],
			 // 演算子の前後にスペースを強制
			'space-infix-ops': ['error'],
			// 連続した空行を注意
			'no-multiple-empty-lines': [1, { 'max': 1 }],
			'vue/no-unused-vars': 'warn',  // Vue内で未使用の変数があれば警告
			'vue/max-attributes-per-line': ['error', { // vueのhtmlの属性を改行
				'singleline': {
					'max': 1
				},      
				'multiline': {
					'max': 1
				}
			}],
			'vue/first-attribute-linebreak': ['error', { // 最初の属性の改行
				'singleline': 'ignore',
				'multiline': 'below'
			}],
			'vue/html-closing-bracket-newline': [ // htmlの閉じ括弧改行
				'error',
				{
				  'singleline': 'never',
				  'multiline': 'always',
				  'selfClosingTag': {
						'singleline': 'never',
						'multiline': 'always'
				  }
				}
			  ],
			'vue/html-indent': ['error', 'tab', { // htmlのtabのインデントを強制
				baseIndent: 1,
				alignAttributesVertically: true,
				ignores: []
			}],

			'vue/multi-word-component-names': 'off', // 追加

			'jsdoc/require-description': 'error'
		}
	},
]);
