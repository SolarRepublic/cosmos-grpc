module.exports = {
	extends: '@blake.regalia/eslint-config-elite',
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
		tsconfigRootDir: __dirname,
		project: 'tsconfig.json',
	},
	plugins: ['unused-imports'],
	rules: {
		'unused-imports/no-unused-imports': 'warn',
		'@typescript-eslint/naming-convention': 'off',
	},
};
