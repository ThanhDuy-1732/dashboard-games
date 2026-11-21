CREATE TABLE IF NOT EXISTS nha_choi_metric_events (
  scope text NOT NULL,
  source text NOT NULL,
  id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  kind text NOT NULL,
  attributes jsonb NOT NULL,
  PRIMARY KEY (scope, source, id)
);
CREATE INDEX IF NOT EXISTS nha_choi_metric_events_time
  ON nha_choi_metric_events(scope, occurred_at);

CREATE TABLE IF NOT EXISTS nha_choi_metric_days (
  scope text NOT NULL,
  day date NOT NULL,
  source text NOT NULL,
  kind text NOT NULL,
  dimensions jsonb NOT NULL,
  count bigint NOT NULL,
  PRIMARY KEY (scope, day, source, kind, dimensions)
);

CREATE TABLE IF NOT EXISTS nha_choi_metric_sizes (
  scope text NOT NULL,
  day date NOT NULL,
  bytes bigint NOT NULL,
  PRIMARY KEY (scope, day)
);

CREATE TABLE IF NOT EXISTS nha_choi_metric_cleanup (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope text NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  cutoff timestamptz NOT NULL,
  kinds text[] NOT NULL,
  deleted integer NOT NULL
);
