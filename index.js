const db = require('./database');
const con = require('./database/connections');
const sm = require('./secretmanager');
const km = require('./keymap');

module.exports = {
    db,
    con,
    sm,
    km,
    database: db,
    connections: con,
    secretmanager: sm,
    keymap: km
};