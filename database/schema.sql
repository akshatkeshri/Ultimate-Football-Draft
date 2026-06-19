-- ============================================================
-- Football Draft Simulator: Database Schema
-- Database: PostgreSQL (Supabase)
-- Author: Akshat Keshri
-- ============================================================

-- Teams table
-- Stores club-level metadata for each drafted team
CREATE TABLE teams (
    id          INTEGER PRIMARY KEY,
    club_name   TEXT NOT NULL,
    league      TEXT NOT NULL,
    country     TEXT NOT NULL,
    season_year TEXT NOT NULL
);

-- Players table
-- Stores individual player records linked to a team
CREATE TABLE players (
    id          INTEGER PRIMARY KEY,
    team_id     INTEGER NOT NULL REFERENCES teams(id),
    player_name TEXT NOT NULL,
    position    TEXT NOT NULL,
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 99)
);

-- Managers table
-- Stores tactical configuration per team
CREATE TABLE managers (
    id           INTEGER PRIMARY KEY,
    team_id      INTEGER NOT NULL REFERENCES teams(id),
    manager_name TEXT NOT NULL,
    formation    TEXT NOT NULL
);

-- Row Level Security (RLS)
-- Public read access enabled on all tables
ALTER TABLE teams    ENABLE ROW LEVEL SECURITY;
ALTER TABLE players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
    ON teams FOR SELECT USING (true);

CREATE POLICY "Public read access"
    ON players FOR SELECT USING (true);

CREATE POLICY "Public read access"
    ON
