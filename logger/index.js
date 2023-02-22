"use strict";

const Console = require('console').Console;

class Logger extends Console {
    constructor(stdout, stderr, ...otherArgs) {
        super(stdout, stderr, ...otherArgs);
    }

    log(...args) {
        super.log((new Date()).toISOString(), ...args);
    }

    info(...args) {
        super.info((new Date()).toISOString(), ...args);
    }

    error(...args) {
        super.error((new Date()).toISOString(), ...args);
    }

    warn(...args) {
        super.warn((new Date()).toISOString(), ...args);
    }
}

module.exports = (function () {
    return new Logger(process.stdout, process.stderr);
}());