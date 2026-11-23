ALTER TABLE nha_choi_metric_days
  ADD COLUMN IF NOT EXISTS duration_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_samples bigint NOT NULL DEFAULT 0;
