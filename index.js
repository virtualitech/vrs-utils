const db = require('./database');
const con = require('./database/connections');
const sm = require('./secretmanager');
const km = require('./keymap');
const lg = require('./logger');
const lib = require('./lib');

module.exports = {
    db,
    con,
    sm,
    km,
    lib,
    database: db,
    connections: con,
    secretmanager: sm,
    keymap: km,
    logger: lg
};