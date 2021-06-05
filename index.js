const { createPgClient, createChClient, createKafkaClient, createRedisClient } = require('./db');
const buildServer = require('./server');

(async () => {
    try {
        const kafka = createKafkaClient();
        const clickhouse = createChClient();
        const pg = createPgClient();
        const redis = createRedisClient();

        const app = await buildServer({ kafka, pg, clickhouse, redis }, { logger: true, trustProxy: true });

        await app.listen(9093, '0.0.0.0');
    } catch (err) {
        console.error(err);
    }
})();
