CREATE TABLE tracking_events (
    date Date,
    date_time DateTime,
    event_id String,
    tracker_id String,
    ip String,
    user_id String,
    user_agent String,
    url String,
    value String
) ENGINE = MergeTree PARTITION BY toYYYYMM(date) ORDER BY (tracker_id) SETTINGS index_granularity = 8192;

CREATE TABLE tracking_events_reader (
    date Date,
    date_time DateTime,
    event_id String,
    tracker_id String,
    ip String,
    user_id String,
    user_agent String,
    url String,
    value String
) ENGINE = Kafka
    SETTINGS
        kafka_broker_list = 'kafka:9092',
        kafka_topic_list = 'tracker-events',
        kafka_group_name = 'tracker-events',
        kafka_format = 'JSONEachRow';

CREATE MATERIALIZED VIEW tracking_events_transport TO tracking_events AS SELECT * FROM tracking_events_reader;
