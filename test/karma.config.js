module.exports = function(config){
	config.set({
		basePath: './',
		frameworks: ['jasmine', 'es6-shim', 'karma-typescript'],
		files: [
			{ pattern: '../src/**/*.ts' },
			{ pattern: './specs/**/*.ts' }
		],
		exclude: [],
		preprocessors: {
			'../src/**/*.ts':  ['karma-typescript', 'sourcemap'],
			'./specs/**/*.ts':  ['karma-typescript', 'sourcemap']
		},
		karmaTypescriptConfig: {
			compilerOptions: {
				noEmitHelpers: false,
				importHelpers: true,
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
				lib: ["es2016"]
			},
			bundlerOptions: {
				resolve: {
					alias: {
						"@blumintinc/fast-deep-equal": "node_modules/@blumintinc/fast-deep-equal/index.js"
					}
				},
				transforms: [
					require("karma-typescript-es6-transform")()
				]
			},
			reports: {
				html: {
					directory: './coverage/typescript-memoize',
					subdirectory: '.',
					filename: 'report'
				},
				lcovonly: {
					directory: './coverage/typescript-memoize',
					subdirectory: '.',
					filename: 'lcov.info'
				}
			}
		},
		reporters: ['spec', 'karma-typescript', 'junit',  'threshold'],
		junitReporter: {
			outputDir: './coverage/typescript-memoize',
			outputFile: 'junit-results.xml',
			suite: 'typescript-memoize',
			useBrowserName: false
		},
		thresholdReporter: {
			statements: 90,
			branches: 75,
			functions: 90,
			lines: 90
		},
		port: 9876,
		colors: true,
		autoWatch: false,
		browsers: ['ChromeHeadless'],
		singleRun: true
	});
};
