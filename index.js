const { createPgClient, createChClient, createKafkaClient } = require('./db');
const buildServer = require('./server');

(async () => {
    try {
        const kafka = createKafkaClient();
        const clickhouse = createChClient();
        const pg = createPgClient();

        const app = await buildServer({ kafka, pg, clickhouse }, { logger: true, trustProxy: true });

        await app.listen(9093, '0.0.0.0');
    } catch (err) {
        console.error(err);
    }
})();
