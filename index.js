const db = require('./database');
const sm = require('./secretmanager');
const km = require('./keymap');

module.exports = {
    db,
    sm,
    km,
    database: db,
    secretmanager: sm,
    keymap: km
};