CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE trackers (
    id bigserial PRIMARY KEY,
    uuid uuid DEFAULT uuid_generate_v4(),
    value character varying(32) NOT NULL
);

INSERT INTO trackers VALUES (DEFAULT, DEFAULT, 'value-1');
INSERT INTO trackers VALUES (DEFAULT, DEFAULT, 'value-2');
INSERT INTO trackers VALUES (DEFAULT, DEFAULT, 'value-3');
INSERT INTO trackers VALUES (DEFAULT, DEFAULT, 'value-4');
INSERT INTO trackers VALUES (DEFAULT, DEFAULT, 'value-5');
