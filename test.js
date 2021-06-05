const { createChClient, createKafkaClient, createPgClient } = require('./db');
const { test } = require('tap');
const rewire = require('rewire');
const uuid = require('uuid');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('trackers test', async t => {
    t.plan(2);

    const buildServer = rewire('./server');

    const kafka = createKafkaClient();
    const clickhouse = createChClient();
    const pg = createPgClient();

    const app = await buildServer({ kafka, pg, clickhouse });

    t.teardown(() => app.close());

    t.test('GET /track', async (trackTest) => {
        const TEST_EVENT_ID = uuid.v4();
        const TEST_USER_ID = 'example';

        buildServer.__set__('uuid', () => TEST_EVENT_ID);

        const response = await app.inject({
            method: 'GET',
            url: '/track',
            query: {
                tracker_id: '1'
            },
            headers: {
                'Cookie': `user_id=${TEST_USER_ID}`
            }
        });

        trackTest.equal(response.statusCode, 200);
        trackTest.same(JSON.parse(response.body), { success: true });

        let tries = 5;

        await sleep(3000);

        while (tries--) {
            const queryResult = await clickhouse.query(`SELECT * FROM tracking_events WHERE event_id = '${TEST_EVENT_ID}'`).toPromise();

            if (queryResult && queryResult[0]) {
                const createdEvent = queryResult[0];

                trackTest.equal(createdEvent.tracker_id, '1');
                trackTest.equal(createdEvent.user_id, TEST_USER_ID);
                trackTest.equal(createdEvent.event_id, TEST_EVENT_ID);

                return;
            } else {
                await sleep(3000);
            }
        }

        throw new Error('Event was not created in CH');
    });

    t.test('GET /stats', async (statsTest) => {
        const TEST_EVENT_ID = uuid.v4();
        const TEST_USER_ID = 'example';

        buildServer.__set__('uuid', () => TEST_EVENT_ID);

        const response = await app.inject({
            method: 'GET',
            url: '/stats',
            query: {
                tracker_id: '1'
            },
            headers: {
                'Cookie': `user_id=${TEST_USER_ID}`
            }
        });

        const body = JSON.parse(response.body);

        statsTest.equal(body.success, true);
        statsTest.type(body.data.count, 'number');
    });
});
