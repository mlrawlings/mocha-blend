const ora = require('ora');
const fork = require('child_process').fork;
const colors = require('colors/safe');
const EventEmitter = require('events').EventEmitter;
const runnerPath = require.resolve('./run-tests');

module.exports = class Runner {
	constructor(glob) {
		this.status = ora();
		this.allFound = false;
		this.complete = false;
		this.passing = 0;
		this.failing = 0;
		this.pending = 0;
		this.found = 0;
		this.start = Date.now();
		this.run(glob);
	}
	run(glob) {
		console.log('');
		this.status.start(colors.gray('loading tests...'));

		runTests(glob)
			.on('tests', (count) => {
				this.found = count;
				this.allFound = true;
				this.updateStatus();
			})
			.on('pass', () => {
				this.passing++;
				this.updateStatus();
			})
			.on('fail', (failure, file) => {
				this.status.stop();

				this.failing++;

				let prefix = ' FAIL ';
				let pad = ' '.repeat(prefix.length+1);

				console.log(colors.bgRed(prefix) + ' ' + failure.title + ' ' + failure.path.join(' \u2192 '));
				console.log(pad + colors.yellow(file) + '\n');
				console.log(pad+colors.red(failure.error.type) + ': ' + failure.error.message.split('\n').join('\n'+pad));
				failure.error.stack.forEach(frame => {
					console.log(colors.gray(pad + '    at ' + frame.file + ':' + frame.line));
				});
				console.log('\n');

				this.updateStatus();
			})
			.on('pending', (pending, file) => {
				try {
				this.status.stop();
				this.pending++;

				let prefix = ' SKIP ';
				let pad = ' '.repeat(prefix.length+1);

				console.log(colors.bgCyan(prefix) + ' ' + pending.title + ' ' + pending.path.join(' \u2192 '));
				console.log(pad + colors.yellow(file) + '\n\n');

				this.updateStatus();
				} catch(e) {
					console.log(e);
				}
			})
			.on('end', () => {
				this.complete = true;
				this.updateStatus();
			});
	}
	updateStatus(action = 'start') {

		let messageParts = [];

		if (this.passing) {
			messageParts.push(colors.green(`${this.passing} passed`));
		}

		if (this.failing) {
			messageParts.push(colors.red(`${this.failing} failed`));
		}

		if (this.pending) {
			messageParts.push(colors.cyan(`${this.pending} skipped`));
		}

		let message = messageParts.join(', ');

		if (!this.allFound) {
			this.status.start(message + ' ' + colors.gray(`loading more tests...`));
		} else if(!this.complete) {
			let remaining = this.found-this.passing-this.failing-this.pending;
			this.status.start(message + ' ' + colors.gray(`${remaining} tests remaining...`));
		} else {
			let duration = formatTime(Date.now() - this.start);
			this.status.text = message + ' ' + colors.gray(`(${duration})`);
			if (this.passing) {
				this.status.succeed();
			} else if(this.failing) {
				this.status.fail();
			} else if (this.pending) {
				this.status.info();
			} else {
				this.status.info('No tests found');
			}

			if (this.failing) {
				process.exit(1);
			} else {
				process.exit(0);
			}
		}
	}
}

function formatTime(ms) {
	let seconds = ms/1000;
	let minutes = Math.floor(seconds/60);
	let formatted = '';

	if (minutes) {
		formatted += minutes+'m '
	}

	return formatted + (seconds-minutes*60) + 's';
}

function runTests(pattern) {
	let process = fork(runnerPath, [pattern]);
	let emitter = new EventEmitter();

	process.on('message', message => {
		if (message.event) {
			emitter.emit(message.event, message.data, message.file);
		}
	});

	return emitter;
}
