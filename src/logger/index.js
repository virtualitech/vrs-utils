"use strict";

class Logger {
    log (...args) {
        console.log((new Date()).toISOString(), ...args);
    }

    info (...args) {
        console.info((new Date()).toISOString(), ...args);
    }

    error (...args) {
        console.error((new Date()).toISOString(), ...args);
    }

    warn (...args) {
        console.warn((new Date()).toISOString(), ...args);
    }
}

module.exports = new Logger();