-- Sessions de jeu (timer piloté côté serveur)
CREATE TABLE IF NOT EXISTS game_sessions (
  team_name   TEXT PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ
);

-- Scores (si pas déjà créée)
CREATE TABLE IF NOT EXISTS scores (
  id               SERIAL PRIMARY KEY,
  team_name        TEXT UNIQUE NOT NULL,
  duration_seconds INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  badge            VARCHAR(20) DEFAULT ''
);
