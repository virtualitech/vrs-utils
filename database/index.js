const moment = require("moment-timezone");
const pg = require("pg");
const { validate, v4: uuidv4 } = require("uuid");
const connections = require("./connections");
const pool = new pg.Pool({ connectionTimeoutMillis: 10000,max: 100 });
const poolForLog = new pg.Pool({ connectionTimeoutMillis: 10000,max: 10 });

pool.on("error", (err) => {
    console.log('[POOL ERROR]');
    console.error(err.stack);
});

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
        return (tz ? moment.tz(v, tz) : moment(v)).toISOString();
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

const { connect } = pool;

//musa
poolForLog.forLog = {
    string : paramString,
    json : paramJson,
    async query(q) {
        // eslint-disable-next-line global-require
        const connectionInfo = await connections();

        let client;
        let result;
        let connection;

        try {
            connection = connectionInfo[process.env.DB_ENV || "development"];
            client = new pg.Client(connection);
            await client.connect();
            result = await client.query(q);
        } catch (err) {
            throw err;
        } finally {
            if (client) {
                client.end();
            }
        }
        return result;
    },    
}

pool.master = {
    queryRows,
    queryFirst,
    async query(q) {
        let client;
        let result;

        try {
            client = await pool.connect(null, "master");
            result = await client.query(q);
        } catch (err) {
            throw err;
        } finally {
            if (client) {
                client.end();
            }
        }

        return result;
    },
};

pool.demo = {
    queryRows,
    queryFirst,
    async query(q) {
        let client;
        let result;

        try {
            client = await pool.connect(null, "demo"); // localde demo_from_local olacak
            result = await client.query(q);
        } catch (err) {
            throw err;
        } finally {
            if (client) {
                client.end();
            }
        }

        return result;
    },
};

pool.stage = {
    queryRows,
    queryFirst,
    async query(q) {
        let client;
        let result;

        try {
            client = await pool.connect(null, "stage"); // localde development olacak
            result = await client.query(q);
        } catch (err) {
            throw err;
        } finally {
            if (client) {
                client.end();
            }
        }

        return result;
    },
};

pool.production = {
    queryRows,
    queryFirst,
    async query(q) {
        let client;
        let result;

        try {
            client = await pool.connect(null, "production_cloudsql"); //  localde production(ipli) olacak
            result = await client.query(q);
        } catch (err) {
            throw err;
        } finally {
            if (client) {
                client.end();
            }
        }

        return result;
    },
};

pool.connect = async function (cb, connection, ...restArgs) {
    // eslint-disable-next-line global-require
    const connectionInfo = await connections();
    let client;

    // console.log('[DB POOL]' + ' TOTAL:'+ pool.totalCount + ' IDLE:' + pool.idleCount + ' EXPIRED:' + pool.expiredCount + ' WAITING:' + pool.waitingCount);
    // console.log('[DB CLIENT TOTAL]' + pool._clients?.length);

    if (connection) {
        connection = connectionInfo[connection];
        client = new pg.Client(connection);
        await client.connect();
    } else {
        connection = connectionInfo[process.env.DB_ENV || "development"];
        pool.options = Object.assign(pool.options, connection);
        try {
            client = await connect.apply(this, [cb, connection, ...restArgs]);
        } catch(err){
            try{
                console.log('err : ' + err);
                let result = await poolForLog.forLog.query(`SELECT pid,state, client_addr,age(clock_timestamp(), query_start), usename, datname,query
                FROM pg_stat_activity ORDER BY query_start desc;`);
                let json = result?.rows;
                await poolForLog.forLog.query(`insert into db_log (session_log) values (${poolForLog.forLog.json(json)});`);
            } catch(err){
                console.log('err : ' + err);
                console.log('[DB POOL]' + ' TOTAL:'+ pool?.totalCount + ' IDLE:' + pool?.idleCount + ' EXPIRED:' + pool?.expiredCount + ' WAITING:' + pool?.waitingCount);
                console.log('[DB CLIENT TOTAL]' + pool?._clients?.length);
            }
        }
    }

    if (client) {
        client.string = paramString;
        client.stringArray = paramStringArray;
        client.numeric = paramNumeric;
        client.uuid = paramUUID;
        client.uuidArray = paramUUIDArray;
        client.numericArray = paramNumericArray;
        client.number = paramNumeric;
        client.numberArray = paramNumericArray;
        client.boolean = paramBoolean;
        client.bool = paramBoolean;
        client.dateFormat = paramDateFormat;
        client.date = paramDate;
        client.json = paramJson;
        client.queryRows = queryRows;
        client.queryFirst = queryFirst;
        client.new = {
            uuid() {
                return uuidv4();
            },
        };
    }

    return client;
};

pool.string = paramString;
pool.stringArray = paramStringArray;
pool.numeric = paramNumeric;
pool.numericArray = paramNumericArray;
pool.number = paramNumeric;
pool.numberArray = paramNumericArray;
pool.uuid = paramUUID;
pool.uuidArray = paramUUIDArray;
pool.boolean = paramBoolean;
pool.bool = paramBoolean;
pool.dateFormat = paramDateFormat;
pool.date = paramDate;
pool.json = paramJson;
pool.queryRows = queryRows;
pool.queryFirst = queryFirst;
pool.queryFile = queryFile;
pool.new = {
    uuid() {
        return uuidv4();
    },
};

module.exports = pool;
