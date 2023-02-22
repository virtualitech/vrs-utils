const database = require('./database');
const connections = require('./database/connections');
const secretmanager = require('./secretmanager');
const keymap = require('./keymap');
const logger = require('./logger');
const storage = require('./storage');
const lib = require('./lib');

module.exports = {
    db: database,
    con: connections,
    sm: secretmanager,
    km: keymap,
    lib,
    database,
    connections,
    secretmanager,
    keymap,
    logger,
    storage
};