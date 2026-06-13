const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// WARNING: Use your massive 'service_role' (secret) key here!
const SUPABASE_URL = 'https://oxknvvtqsrkmjrodmwex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94a252dnRxc3JrbWpyb2Rtd2V4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTExOTE3NiwiZXhwIjoyMDk2Njk1MTc2fQ.fkJs7EBxyow2SzLJoyGTtuVgHgAnaIoqX7IMag2lmCE'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const validLeagueIds = [13, 16, 19, 31, 53];
const coachToTeamMap = new Map(); // We will map coach_id -> team_id here

async function patchManagers() {
  console.log("1. Reading male_teams.csv to find the hidden coach IDs...");
  await new Promise((resolve) => {
    fs.createReadStream('./male_teams.csv')
      .pipe(csv())
      .on('data', (row) => {
        // Look for our FIFA 23 top-tier teams
        if (parseInt(row.fifa_version) === 23 && parseInt(row.league_level) === 1 && validLeagueIds.includes(parseInt(row.league_id))) {
          const teamId = parseInt(row.team_id);
          const coachId = parseInt(row.coach_id); // Grab the hidden coach link!
          
          if (coachId) {
            coachToTeamMap.set(coachId, teamId);
          }
        }
      })
      .on('end', resolve);
  });

  console.log(`✅ Found ${coachToTeamMap.size} coach links from the teams file.`);

  const managersArray = [];
  // Realistic formations for the draft mechanic since the dataset lacks them
  const formations = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '4-3-2-1'];

  console.log("2. Scanning male_coaches.csv to get their actual names...");
  await new Promise((resolve) => {
    fs.createReadStream('./male_coaches.csv')
      .pipe(csv())
      .on('data', (row) => {
        const coachId = parseInt(row.coach_id);
        
        // If this coach matches a top-tier team, prep them for upload!
        if (coachToTeamMap.has(coachId)) {
          const teamId = coachToTeamMap.get(coachId);
          const randomTactics = formations[Math.floor(Math.random() * formations.length)];
          
          managersArray.push({
            id: coachId,
            team_id: teamId,
            manager_name: row.short_name || row.long_name,
            formation: randomTactics
          });
        }
      })
      .on('end', resolve);
  });

  console.log(`✅ Matched ${managersArray.length} Managers. Commencing cloud upload...`);
  
  if (managersArray.length > 0) {
    const { error: uploadError } = await supabase.from('managers').upsert(managersArray);
    if (uploadError) {
      console.error("Upload Error:", uploadError.message);
    } else {
      console.log("🎉 Managers successfully patched! Your database is 100% complete.");
    }
  } else {
    console.log("Still finding 0 managers.");
  }
}

patchManagers();