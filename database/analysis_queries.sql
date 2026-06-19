-- ============================================================
-- Football Draft Simulator: Statistical Analysis Queries
-- Database: PostgreSQL (Supabase)
-- Author: Akshat Keshri
-- Purpose: Player benchmarking, squad analytics,
--          and league-level talent distribution analysis
-- ============================================================


-- ============================================================
-- QUERY 1: Squad Overall Rating Leaderboard
-- Ranks all drafted teams by their average squad rating
-- ============================================================
SELECT
    t.club_name,
    t.league,
    t.country,
    COUNT(p.id)                  AS squad_size,
    ROUND(AVG(p.rating), 2)      AS avg_squad_rating,
    MAX(p.rating)                AS highest_rated_player,
    MIN(p.rating)                AS lowest_rated_player,
    RANK() OVER (ORDER BY AVG(p.rating) DESC) AS squad_rank
FROM teams t
JOIN players p ON p.team_id = t.id
GROUP BY t.id, t.club_name, t.league, t.country
ORDER BY avg_squad_rating DESC;


-- ============================================================
-- QUERY 2: Best Player Per Position (Window Function)
-- Identifies the highest-rated player in each position
-- across all drafted squads
-- ============================================================
WITH ranked_players AS (
    SELECT
        p.player_name,
        p.position,
        p.rating,
        t.club_name,
        RANK() OVER (PARTITION BY p.position ORDER BY p.rating DESC) AS position_rank
    FROM players p
    JOIN teams t ON t.id = p.team_id
)
SELECT
    position,
    player_name,
    club_name,
    rating
FROM ranked_players
WHERE position_rank = 1
ORDER BY rating DESC;


-- ============================================================
-- QUERY 3: League Talent Distribution Analysis
-- Identifies which leagues contain the deepest talent pools
-- ============================================================
SELECT
    t.league,
    COUNT(DISTINCT t.id)          AS teams_in_league,
    COUNT(p.id)                   AS total_players,
    ROUND(AVG(p.rating), 2)       AS avg_rating,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.rating) AS median_rating,
    ROUND(STDDEV(p.rating), 2)    AS rating_std_dev,
    MAX(p.rating)                 AS peak_rating
FROM teams t
JOIN players p ON p.team_id = t.id
GROUP BY t.league
ORDER BY avg_rating DESC;


-- ============================================================
-- QUERY 4: Full Squad Intelligence Report (3-Table JOIN)
-- Combines player, team, and manager data to produce a
-- complete squad profile with tactical context
-- ============================================================
SELECT
    t.club_name,
    t.league,
    t.country,
    m.manager_name,
    m.formation,
    COUNT(p.id)              AS squad_size,
    ROUND(AVG(p.rating), 2)  AS avg_rating,
    MAX(p.rating)            AS star_player_rating
FROM teams t
JOIN players p ON p.team_id = t.id
JOIN managers m ON m.team_id = t.id
GROUP BY t.id, t.club_name, t.league, t.country, m.manager_name, m.formation
ORDER BY avg_rating DESC;


-- ============================================================
-- QUERY 5: Player Rating Tier Classification (CASE Statement)
-- Segments all players into performance tiers to support
-- draft strategy and squad balancing decisions
-- ============================================================
SELECT
    p.player_name,
    p.position,
    p.rating,
    CASE
        WHEN p.rating >= 90 THEN 'Elite'
        WHEN p.rating >= 80 THEN 'World Class'
        WHEN p.rating >= 70 THEN 'Professional'
        WHEN p.rating >= 60 THEN 'Developing'
        ELSE 'Academy'
    END AS performance_tier,
    t.club_name
FROM players p
JOIN teams t ON t.id = p.team_id
ORDER BY p.rating DESC;


-- ============================================================
-- QUERY 6: Formation Frequency & Tactical Effectiveness
-- Analyzes which formations correlate with higher squad ratings
-- ============================================================
SELECT
    m.formation,
    COUNT(DISTINCT m.team_id)    AS teams_using_formation,
    ROUND(AVG(p.rating), 2)      AS avg_squad_rating,
    MAX(p.rating)                AS best_player_in_formation
FROM managers m
JOIN players p ON p.team_id = m.team_id
GROUP BY m.formation
ORDER BY avg_squad_rating DESC;


-- ============================================================
-- QUERY 7: CTE — Elite Squad Identification
-- Isolates squads whose average rating exceeds the global
-- average and shows their rating delta
-- ============================================================
WITH global_avg AS (
    SELECT ROUND(AVG(rating), 2) AS overall_avg
    FROM players
),
squad_ratings AS (
    SELECT
        t.club_name,
        t.league,
        ROUND(AVG(p.rating), 2) AS avg_squad_rating
    FROM teams t
    JOIN players p ON p.team_id = t.id
    GROUP BY t.id, t.club_name, t.league
)
SELECT
    sr.club_name,
    sr.league,
    sr.avg_squad_rating,
    ga.overall_avg,
    ROUND(sr.avg_squad_rating - ga.overall_avg, 2) AS rating_delta
FROM squad_ratings sr
CROSS JOIN global_avg ga
WHERE sr.avg_squad_rating > ga.overall_avg
ORDER BY rating_delta DESC;


-- ============================================================
-- QUERY 8: Position Depth & Scarcity Index
-- Shows which positions are most scarce across all squads
-- useful for draft strategy optimization
-- ============================================================
SELECT
    position,
    COUNT(*)                  AS total_drafted,
    ROUND(AVG(rating), 2)     AS avg_position_rating,
    MAX(rating)               AS ceiling,
    MIN(rating)               AS floor,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2
    ) AS pct_of_total_squad
FROM players
GROUP BY position
ORDER BY avg_position_rating DESC;
