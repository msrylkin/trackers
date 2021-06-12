const fastify = require('fastify');
const { v4: uuid, validate: uuidValidate } = require('uuid');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const SqlString = require('sqlstring');
const fastifyCookie = require('fastify-cookie');
const { promisify } = require("util");

dayjs.extend(utc);

const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FORMAT = 'YYYY-MM-DD';

const TRACKER_CACHE_TTL_SECONDS = 60 * 5; // 5 минут

const getCacheTrackerKey = trackerId => `cache:trackers:${trackerId}`;

async function build({ kafka, pg, clickhouse, redis }, fastifyOpts = {}) {
    const redisGet = promisify(redis.get.bind(redis));
    const redisSetEx = promisify(redis.setex.bind(redis));

    const app = fastify(fastifyOpts);

    app.register(fastifyCookie, {});

    const producer = kafka.producer();

    await producer.connect();
    await pg.connect();

    app.get('/track', async (req, reply) => {
        const { id: trackerUuid } = req.query;
        const { user_id } = req.cookies || {};
        const newUserId = uuid();

        if (!uuidValidate(trackerUuid)) {
            return reply.code(422).send({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Wrong id query param',
            });
        }

        let tracker;

        const cachedTracker = await redisGet(getCacheTrackerKey(trackerUuid));

        if (cachedTracker) {
            tracker = JSON.parse(cachedTracker);
        } else {
            const result = await pg.query(`SELECT * FROM trackers WHERE uuid = $1`, [ trackerUuid ]);
            tracker = result && result.rows && result.rows[0];

            if (tracker) {
                redisSetEx(
                    getCacheTrackerKey(trackerUuid),
                    TRACKER_CACHE_TTL_SECONDS,
                    JSON.stringify(tracker)
                ).catch(err => {
                    app.log.error(
                        `Error at setting tracker cache, trackerUUID: ${trackerUuid} `
                        + `message: ${err.message} stack: ${err.stack}`
                    );
                });
            }
        }

        if (!tracker) {
            return reply.code(404).send({
                success: false,
                code: 'NOT_FOUND',
                message: `Tracker with uuid ${trackerUuid} was not found`,
            });
        }

        const eventId = uuid();
        const eventDate = new Date();

        await producer.send({
            topic: 'tracker-events',
            messages: [
                {
                    key: eventId,
                    value: JSON.stringify({
                        date: dayjs(eventDate).utc().format(DATE_FORMAT),
                        date_time: dayjs(eventDate).utc().format(DATETIME_FORMAT),
                        event_id: eventId,
                        tracker_id: trackerUuid,
                        ip: req.ip,
                        user_id: user_id || newUserId,
                        user_agent: req.headers['user-agent'],
                        url: `${req.protocol}://${req.hostname}${req.url}`,
                        value: tracker.value,
                    }),
                }
            ]
        });

        return reply.cookie('user_id', newUserId).code(204).send();
    });

    app.get('/stats', async (req, reply) => {
        const { tracker_id: trackerId, from, to } = req.query;

        if ((from && !dayjs(from).isValid()) || (to && !dayjs(to).isValid())) {
            return reply.code(422).send({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Wrong "from" or/and "to" parameters',
            })
        }

        let query = `SELECT count() as count FROM tracking_events`;

        if (trackerId) {
            query += ` WHERE tracker_id = ${SqlString.escape(trackerId)}`;
        }

        if (from) {
            query += ` ${trackerId ? 'AND' : 'WHERE'} date_time > '${dayjs(from).format(DATETIME_FORMAT)}'`;
        }

        if (to) {
            query += ` ${trackerId || to ? 'AND' : 'WHERE'} date_time < '${dayjs(to).format(DATETIME_FORMAT)}'`;
        }

        const [ { count } ] = await clickhouse.query(query).toPromise();

        return {
            success: true,
            data: {
                count,
            },
        };
    });

    app.get('/set-cookie', async (req, reply) => {
        reply.cookie('user_id', uuid()).send({ success: true });
    });

    app.addHook('onClose', () => {
       producer.disconnect();
       pg.end();
       redis.quit();
    });

    return app;
}

module.exports = build;
