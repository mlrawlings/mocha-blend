const formatStackTrace =
	Error.prepareStackTrace || require('traceback').v8.FormatStackTrace;

Error.prepareStackTrace = function(error, rawStack) {
	if (!error.rawStack) {
		Object.defineProperty(error, 'rawStack', { value:rawStack });
	}
	return formatStackTrace(error, rawStack);
};

module.exports = function MessageReporter(runner) {
	runner.on('start', () => {
		send('tests', runner.total);
	});
	runner.on('end', () => {
		send('end');
	});
	runner.on('suite', suite => {});
	runner.on('suite end', suite => {});
	runner.on('test end', test => {});
	runner.on('hook', hook => {});
	runner.on('hook end', hook => {});
	runner.on('pass', test => {
		send('pass');
	});
	runner.on('fail', (test, error) => {
		send('fail', createTestObject(test, error));
	});
	runner.on('pending', test => {
		send('pending', createTestObject(test));
	});
};

function createTestObject(test, error) {
	let path = [];
	let current = test.parent;

	while (current && current.title) {
		path.unshift(current.title);
		current = current.parent;
	}

	return {
		title: test.title,
		path,
		error: error && {
			type: error.constructor.name,
			message: error.message,
			stack: error.rawStack.map(site => ({
				file: site.getFileName(),
				line: site.getLineNumber(),
				column: site.getColumnNumber(),
				fn: site.getFunctionName(),
			})).filter(frame => !/node_modules\/mocha/.test(frame.file)),
		}
	};
}

function send(name, ...args) {
	process.send({ mocha: true, name, args });
}