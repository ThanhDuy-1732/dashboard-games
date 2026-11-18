CREATE TABLE IF NOT EXISTS nha_choi_backend_leases (
  scope text PRIMARY KEY,
  owner uuid,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS nha_choi_room_checkpoints (
  scope text NOT NULL,
  id uuid NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{6}$'),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (scope, id),
  UNIQUE (scope, code)
);
