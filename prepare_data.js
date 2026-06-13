const fs = require('fs');
const csv = require('csv-parser');

const teamsInput = 'C:/Users/aksha/Downloads/github dataset/team_details.csv';
const playersInput = 'C:/Users/aksha/Downloads/github dataset/player_profiles.csv';

const targetLeagues = {
  'GB1': 'Premier League',
  'ES1': 'La Liga',
  'IT1': 'Serie A',
  'L1': 'Bundesliga',
  'FR1': 'Ligue 1'
};

const teamsOutput = fs.createWriteStream('./final_teams.csv');
const playersOutput = fs.createWriteStream('./final_players.csv');

teamsOutput.write('id,club_name,league,country,season_year\n');
playersOutput.write('id,team_id,player_name,position,rating\n');

const validTeamIds = new Set();

console.log("Reading Teams...");

fs.createReadStream(teamsInput)
  .pipe(csv())
  .on('data', (row) => {
    // UPDATED: Using exact headers from your file
    const compId = row.competition_id;
    
    if (targetLeagues[compId]) {
      const teamId = row.club_id;
      validTeamIds.add(teamId);
      
      const name = row.club_name;
      const leagueName = targetLeagues[compId];
      const country = row.country_name;
      const year = row.season_id || '2023';

      teamsOutput.write(`${teamId},"${name}","${leagueName}","${country}","${year}"\n`);
    }
  })
  .on('end', () => {
    console.log(`Saved ${validTeamIds.size} top-tier teams!`);
    console.log("Now mapping Players to those teams...");

    fs.createReadStream(playersInput)
      .pipe(csv())
      .on('data', (row) => {
        // UPDATED: Using exact headers from your file
        const teamId = row.current_club_id;
        
        if (validTeamIds.has(teamId)) {
          const playerId = row.player_id;
          const name = row.player_name;
          
          let pos = row.position || 'Unknown';
          if (pos.includes('Midfield')) pos = 'CM';
          else if (pos.includes('Attack') || pos.includes('Winger')) pos = 'ST';
          else if (pos.includes('Defender') || pos.includes('Back')) pos = 'CB';
          else if (pos.includes('Goalkeeper')) pos = 'GK';

          // Because market value isn't in this file, we give them a random gold rating (75-92)
          // You can always update this later with real FIFA stats!
          const rating = Math.floor(Math.random() * (92 - 75 + 1)) + 75;

          playersOutput.write(`${playerId},${teamId},"${name}","${pos}",${rating}\n`);
        }
      })
      .on('end', () => {
        console.log("Done! Clean files are ready for Supabase.");
      });
  });
  