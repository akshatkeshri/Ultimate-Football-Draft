const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// WARNING: Use your massive 'service_role' (secret) key here!
const SUPABASE_URL = 'https://oxknvvtqsrkmjrodmwex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94a252dnRxc3JrbWpyb2Rtd2V4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTExOTE3NiwiZXhwIjoyMDk2Njk1MTc2fQ.fkJs7EBxyow2SzLJoyGTtuVgHgAnaIoqX7IMag2lmCE'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const validLeagueIds = [13, 16, 19, 31, 53];

const teamsMap = new Map();
const managersArray = [];

async function seedDatabase() {
  console.log("1. Parsing male_teams.csv...");
  await new Promise((resolve) => {
    fs.createReadStream('./male_teams.csv')
      .pipe(csv())
      .on('data', (row) => {
        const fifaVersion = parseInt(row.fifa_version);
        const leagueId = parseInt(row.league_id);
        const leagueLevel = parseInt(row.league_level);

        // CHANGED TO 23: Looking for FIFA 23 data!
        if (fifaVersion === 23 && leagueLevel === 1 && validLeagueIds.includes(leagueId)) {
          const teamId = parseInt(row.team_id);
          teamsMap.set(teamId, {
            id: teamId,
            club_name: row.team_name,
            league: row.league_name,
            country: row.nationality_name || 'Unknown',
            season_year: '2023'
          });
        }
      })
      .on('end', resolve);
  });
  console.log(`✅ Found ${teamsMap.size} Top-Tier Teams for FIFA 23.`);

  console.log("2. Parsing male_coaches.csv...");
  await new Promise((resolve) => {
    fs.createReadStream('./male_coaches.csv')
      .pipe(csv())
      .on('data', (row) => {
        // CHANGED TO 23
        if (parseInt(row.fifa_version) === 23) {
          const teamId = parseInt(row.club_team_id);
          if (teamsMap.has(teamId)) {
            managersArray.push({
              id: parseInt(row.coach_id),
              team_id: teamId,
              manager_name: row.short_name,
              formation: row.preferred_formation || '4-3-3'
            });
          }
        }
      })
      .on('end', resolve);
  });
  console.log(`✅ Found ${managersArray.length} Managers.`);

  console.log("3. Uploading Teams and Managers to Cloud...");
  if (teamsMap.size > 0) {
    const { error: tErr } = await supabase.from('teams').upsert(Array.from(teamsMap.values()));
    if (tErr) return console.error("Team Upload Error:", tErr);
  }
  if (managersArray.length > 0) {
    const { error: mErr } = await supabase.from('managers').upsert(managersArray);
    if (mErr) return console.error("Manager Upload Error:", mErr);
  }
  console.log("✅ Structural data secured. Commencing safe player stream...");

  let playersBatch = [];
  let totalUploaded = 0;
  const playerStream = fs.createReadStream('./male_players.csv').pipe(csv());

  playerStream.on('data', async (row) => {
    // CHANGED TO 23
    if (parseInt(row.fifa_version) === 23) {
      const teamId = parseInt(row.club_team_id);
      
      if (teamsMap.has(teamId)) {
        playersBatch.push({
          id: parseInt(row.player_id),
          team_id: teamId,
          player_name: row.short_name,
          position: row.player_positions.split(',')[0].trim(),
          rating: parseInt(row.overall)
        });

        if (playersBatch.length >= 500) {
          playerStream.pause();
          
          const batchToUpload = [...playersBatch];
          playersBatch = []; 

          const { error } = await supabase.from('players').upsert(batchToUpload);
          if (error) {
            console.error("Batch Error:", error.message);
          } else {
            totalUploaded += batchToUpload.length;
            console.log(`...successfully synced ${totalUploaded} players`);
          }
          
          playerStream.resume();
        }
      }
    }
  });

  playerStream.on('end', async () => {
    if (playersBatch.length > 0) {
      const { error } = await supabase.from('players').upsert(playersBatch);
      if (error) console.error("Final Batch Error:", error.message);
      else {
        totalUploaded += playersBatch.length;
        console.log(`...successfully synced ${totalUploaded} players`);
      }
    }
    console.log("🎉 Absolute Success! Database perfectly seeded with FIFA 23 data!");
  });
}

seedDatabase();