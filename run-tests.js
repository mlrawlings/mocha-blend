const os = require('os');
const glob = require('glob');
const fork = require('child_process').fork;
const EventEmitter = require('events').EventEmitter;
const _mocha = require.resolve('mocha/bin/_mocha');
const messageReporterPath = require.resolve('./message-reporter');
const pattern = process.argv[2];

runTestsForGlob(pattern);

function runTestsForGlob(pattern) {
    let numFiles = 0;
    let completedFiles = 0;
    let reportedFiles = 0;
    let reportedTests = 0;
    let allFilesFound = false;

    const finder = glob(pattern, {
        ignore: ['**/node_modules/**'],
    });

    finder.on('error', error => {
        throw error;
    });

    finder.on('end', () => {
        allFilesFound = true;
    });

    finder.on('match', file => {
        numFiles++;
        runTestForFile(file);
    });

    function runTestForFile(file) {
        let args = [file];

        args.push('--reporter', messageReporterPath);

        let child = fork(_mocha, args);

        child.on('message', message => {
            if (message.mocha === true) {
                if (message.name === 'end') {
                    if (++completedFiles === numFiles) {
                        process.send({ event:'end' });
                    }
                } else if (message.name === 'tests') {
                    reportedTests += message.args[0];
                    if (++reportedFiles === numFiles) {
                        process.send({ event:'tests', data:reportedTests });
                    }
                } else {
                    process.send({ 
                        event:message.name, 
                        data:message.args && message.args[0],
                        file
                    });
                }
            }
        });
    }
}
