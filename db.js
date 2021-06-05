const { Client } = require('pg');
const { ClickHouse } = require('clickhouse');
const { Kafka } = require('kafkajs');

function createPgClient() {
    return new Client({
        user: 'trackers-db',
        password: '123456',
        host: 'trackers-pg-db',
        port: 5432,
        database: 'trackers'
    });
}

function createChClient() {
    return new ClickHouse({
        url: 'http://tracker-ch-db',
        port: 8123,
    });
}

function createKafkaClient() {
    return new Kafka({
        clientId: 'trackers-kafka-client',
        brokers: ['kafka:9092']
    });
}

module.exports = {
    createPgClient,
    createKafkaClient,
    createChClient
}
