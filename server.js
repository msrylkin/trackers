const fastify = require('fastify');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const SqlString = require('sqlstring');
const fastifyCookie = require('fastify-cookie');

dayjs.extend(utc);

const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FORMAT = 'YYYY-MM-DD';

async function build({ kafka, pg, clickhouse, onClose }, fastifyOpts = {}) {
    const app = fastify(fastifyOpts);

    app.register(fastifyCookie, {});

    const producer = kafka.producer();

    await producer.connect();
    await pg.connect();

    app.get('/track', async (req, reply) => {
        const { tracker_id } = req.query;
        const { user_id } = req.cookies || {};

        if (!tracker_id) {
            return reply.code(422).send({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Wrong tracker_id query param',
            });
        }

        if (!user_id) {
            return reply.code(403).send({
                success: false,
                code: 'UNAUTHORIZED',
                message: 'Missing user_id cookie',
            });
        }

        const result = await pg.query(`SELECT * FROM trackers WHERE id = $1`, [ tracker_id ]);
        const tracker = result && result.rows && result.rows[0];

        if (!tracker) {
            return reply.code(404).send({
                success: false,
                code: 'NOT_FOUND',
                message: `Tracker with id ${tracker_id} was not found`,
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
                        tracker_id: tracker.id,
                        ip: req.ip,
                        user_id: req.cookies.user_id,
                        user_agent: req.headers['user-agent'],
                        url: `${req.protocol}://${req.hostname}${req.url}`,
                        value: tracker.value,
                    }),
                }
            ]
        });

        return reply.send({
            success: true
        });
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
    });

    return app;
}

module.exports = build;
