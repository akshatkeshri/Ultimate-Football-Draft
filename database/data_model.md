# Football Draft Simulator — Data Model

## Overview
A PostgreSQL relational database (hosted on Supabase) powers the 
core data layer of this application, managing player records, club 
attributes, and tactical configurations across drafted squads.

Row Level Security (RLS) policies are enforced on all tables to 
ensure users can only read and write their own session data.

---

## Schema

### `Teams`
Stores club-level metadata for each drafted team.

| Column | Type | Description |
|---|---|---|
| id | integer | Primary key |
| club_name | text | Official club name |
| league | text | League the club competes in |
| country | text | Country of origin |
| season_year | text | Season context (e.g. 2024/25) |

---

### `Players`
Stores individual player records with positional and performance data.

| Column | Type | Description |
|---|---|---|
| id | integer | Primary key |
| team_id | integer | Foreign key → teams.id |
| player_name | text | Player's name |
| position | text | Playing position (GK, CB, CM, ST etc.) |
| rating | integer | Overall performance rating (0–99) |

---

### `Managers`
Stores tactical and managerial configuration per team.

| Column | Type | Description |
|---|---|---|
| id | integer | Primary key |
| team_id | integer | Foreign key → teams.id |
| manager_name | text | Manager's name |
| formation | text | Tactical formation (e.g. 4-3-3, 4-4-2) |

---

## Relationships
Each team has one manager and a squad of players.
Players and managers both reference `teams.id` as a foreign key.

---

## Key Design Decisions

**Rating as integer:** Player ratings are stored as integers (0–99),
mirroring industry-standard football simulation scoring systems.
This enables direct mathematical operations for squad OVR 
calculations and percentile ranking without type casting.

**Formation as text:** Formations are stored as free-text strings 
(e.g. "4-3-3") rather than an enum, allowing flexible tactical 
configurations without schema migrations as new formations are added.

**RLS Policies:** Public read access is granted on all tables to 
support real-time client-side queries via the Supabase JS client,
while write operations are restricted to authenticated sessions.
