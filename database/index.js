const moment = require("moment-timezone");
const pg = require("pg");
const { validate, v4: uuidv4 } = require("uuid");
const connections = require("./connections");
const pools = {};
const defaultConfig = { connectionTimeoutMillis: 10000 };

const nullable = function (v) {
    return typeof v === "undefined" ? null : v;
};

const paramUUID = function (v, insecure) {
    v = nullable(v);

    if (v !== null && !validate(v)) {
        throw new Error("DB param is not UUID");
    }

    if (v === null) {
        return null;
    }

    return insecure !== true ? `'${v}'` : v;
};

const paramUUIDArray = function (v, insecure) {
    v = nullable(v);

    if (!Array.isArray(v)) {
        // eslint-disable-next-line sonarjs/no-duplicate-string
        throw new Error("DB param is not an array");
    }

    v = [].concat(v);

    for (let i = 0, len = v.length; i < len; i += 1) {
        v[i] = this.uuid(v[i], insecure);
    }

    return v;
};

const paramString = function (v, insecure) {
    v = nullable(v);

    if (v !== null) {
        v = String(v);

        if (typeof v !== "string") {
            throw new Error("DB param is not string");
        }
    }

    if (v === null) {
        return null;
    }

    return v !== "" && insecure !== true ? `$$${v}$$` : v;
};

const paramNumeric = function (v) {
    v = nullable(v);

    if (v !== null) {
        v = Number(v);

        if (Number.isNaN(v)) {
            throw new Error("DB param is not numeric");
        }
    }

    return v;
};

const paramBoolean = function (v) {
    v = nullable(v);

    if (v === "true") {
        v = true;
    } else if (v === "false") {
        v = false;
    }

    if (v !== true && v !== false) {
        throw new Error("DB param is not boolean");
    }

    return v;
};

const paramDateFormat = function (v, tz) {
    v = nullable(v);

    if (v !== null) {
        return tz ? moment.tz(v, tz).format('YYYY-MM-DD HH:mm:ss ZZ') : moment(v).format('YYYY-MM-DD HH:mm:ss ZZ');
    }

    return null;
};

const paramDate = function (v, tz) {
    return this.string(this.dateFormat(v, tz));
};

const paramJson = function (v) {
    v = nullable(v);

    return v !== null ? this.string(JSON.stringify(v)) : null;
};

const paramNumericArray = function (v) {
    v = nullable(v);

    if (!Array.isArray(v)) {
        throw new Error("DB param is not an array");
    }

    v = [].concat(v);

    for (let i = 0, len = v.length; i < len; i += 1) {
        v[i] = this.numeric(v[i]);
    }

    return v;
};

const paramStringArray = function (v) {
    v = nullable(v);

    if (!Array.isArray(v)) {
        throw new Error("DB param is not an array");
    }

    v = [].concat(v);

    for (let i = 0, len = v.length; i < len; i += 1) {
        v[i] = this.string(v[i]);
    }

    return v;
};

const queryRows = function (q) {
    return this.query(q).then((result) => result.rows);
};

const queryFirst = function (q, v = null) {
    return this.query(q, v).then((result) => result.rows[0]);
};

const queryFile = function (client, sql) {
    const queries = sql
        .replace(/(\r\n|\n|\r)/gm, " ") // remove newlines
        .replace(/\s+/g, " ") // excess white space
        .split(";") // split into all statements
        .map(Function.prototype.call, String.prototype.trim)
        .filter((el) => el.length !== 0); // remove any empty ones

    return Promise.all(queries.map((query) => client.query(query)));
};

const connect = pg.Pool.prototype.connect;

Object.assign(pg.Pool.prototype, {
    string: paramString,
    stringArray: paramStringArray,
    numeric: paramNumeric,
    numericArray: paramNumericArray,
    number: paramNumeric,
    numberArray: paramNumericArray,
    uuid: paramUUID,
    uuidArray: paramUUIDArray,
    boolean: paramBoolean,
    bool: paramBoolean,
    dateFormat: paramDateFormat,
    date: paramDate,
    json: paramJson,
    queryRows: queryRows,
    queryFirst: queryFirst,
    queryFile: queryFile,
    new: {
        uuid () {
            return uuidv4();
        },
    },
    configured: false,
    async connect (callback) {
        if (!this.configured) {
            const cons = await connections();
            const { dbKey, key } = this.options;

            if (!dbKey) {
                throw new Error('No db connection key found');
            }

            const config = cons[dbKey];

            if (!config) {
                throw new Error('No db connection config found: ' + dbKey);
            }

            pools[key] = this;

            this.on("error", async (err) => {
                console.error('[DB POOL ERROR]', err.message);
            });

            this.options = Object.assign(this.options, config);
            this.configured = true;
        }

        if (this.totalCount === 10) {
            try {
                console.error('[DB POOL ERROR]' + ' TOTAL:' + this.totalCount + ' IDLE:' + this.idleCount + ' EXPIRED:' + this.expiredCount + ' WAITING:' + this.waitingCount);

                const result = await logPool.queryRows(`
                    SELECT pid,state, client_addr,age(clock_timestamp(), query_start), usename, datname,query
                    FROM pg_stat_activity ORDER BY query_start desc;
                `);

                const dbLog = await logPool.queryFirst(`
                    insert into db_log (session_log)
                    values (${logPool.json(result)})
                    returning id;
                `);

                console.error('[DB POOL ERROR]' + ' LOG ID: ' + dbLog.id);
            }
            catch (err) {
                console.error('[DB LOG POOL ERROR]', err.message);
                console.error('[DB LOG POOL ERROR]' + ' TOTAL:' + this.totalCount + ' IDLE:' + this.idleCount + ' EXPIRED:' + this.expiredCount + ' WAITING:' + this.waitingCount);
                console.error('[DB LOG POOL ERROR]' + this._clients?.length);
            }
        }

        return connect.call(this, callback);
    }
});

Object.assign(pg.Client.prototype, {
    string: paramString,
    stringArray: paramStringArray,
    numeric: paramNumeric,
    uuid: paramUUID,
    uuidArray: paramUUIDArray,
    numericArray: paramNumericArray,
    number: paramNumeric,
    numberArray: paramNumericArray,
    boolean: paramBoolean,
    bool: paramBoolean,
    dateFormat: paramDateFormat,
    date: paramDate,
    json: paramJson,
    queryRows: queryRows,
    queryFirst: queryFirst,
    new: {
        uuid () {
            return uuidv4();
        },
    },
    begin () {
        return this.query('begin');
    },
    async commit () {
        await this.query('commit');
        return this.release();
    },
    async rollback () {
        await this.query('rollback');
        return this.release();
    }
});

const defaultPool = new pg.Pool(Object.assign({ dbKey: process.env.DB_ENV || "development", key: process.env.DB_ENV || "development" }, defaultConfig));
const logPool = new pg.Pool(Object.assign({ dbKey: process.env.DB_ENV || "development", key: 'log' }, defaultConfig));

defaultPool.pool = async function (key) {
    let pool = pools[key];

    if (pool) {
        return pool;
    }

    pool = new pg.Pool(Object.assign({ dbKey: key, key }, defaultConfig));

    return pool;
};

process.on('SIGTERM', async () => {
    console.warn('[SIGTERM CLEAR POOLS]');

    for (var key in pools) {
        await pools[key].end();
    }

    process.exit(0);
});

module.exports = defaultPool;
