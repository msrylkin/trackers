const fs = require('fs');
const path = require('path');
const { createChClient, createPgClient } = require('./db');

const chInitScript = fs.readFileSync(path.join(__dirname, './ch-init.sql')).toString('utf-8');
const pgInitScript = fs.readFileSync(path.join(__dirname, './pg-init.sql')).toString('utf-8');

(async () => {
    const pg = createPgClient();
    const clickhouse = createChClient();

    await pg.connect();

    const splittedQueries = chInitScript.split('\n\n'); // клиент ch не может выполнить несколько запросов за раз

    for (const chQuery of splittedQueries) {
        await clickhouse.query(chQuery).toPromise();
    }

    await pg.query(pgInitScript);

    await pg.end();
})();
