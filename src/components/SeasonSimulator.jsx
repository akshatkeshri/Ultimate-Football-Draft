"use client";
import { useState, useEffect, useRef } from "react";

// --- HISTORICAL 2022/2023 CHAMPIONS LEAGUE GROUPS ---
const UCL_2022_BASE = {
  A: [{ name: "Napoli", ovr: 84 }, { name: "Liverpool", ovr: 85 }, { name: "Ajax", ovr: 79 }, { name: "Rangers", ovr: 76 }],
  B: [{ name: "FC Porto", ovr: 80 }, { name: "Club Brugge", ovr: 79 }, { name: "Bayer 04 Leverkusen", ovr: 81 }, { name: "Atlético Madrid", ovr: 83 }],
  C: [{ name: "Bayern Munich", ovr: 88 }, { name: "Inter", ovr: 84 }, { name: "Barcelona", ovr: 85 }, { name: "Viktoria Plzeň", ovr: 74 }],
  D: [{ name: "Tottenham Hotspur", ovr: 83 }, { name: "Eintracht Frankfurt", ovr: 78 }, { name: "Sporting CP", ovr: 79 }, { name: "Olympique Marseille", ovr: 80 }],
  E: [{ name: "Chelsea", ovr: 84 }, { name: "Milan", ovr: 83 }, { name: "FC Salzburg", ovr: 79 }, { name: "Dinamo Zagreb", ovr: 76 }],
  F: [{ name: "Real Madrid", ovr: 88 }, { name: "RB Leipzig", ovr: 82 }, { name: "Shakhtar Donetsk", ovr: 77 }, { name: "Celtic", ovr: 78 }],
  G: [{ name: "Manchester City", ovr: 88 }, { name: "Borussia Dortmund", ovr: 82 }, { name: "Sevilla", ovr: 81 }, { name: "FC Copenhagen", ovr: 76 }],
  H: [{ name: "Benfica", ovr: 81 }, { name: "Paris Saint-Germain", ovr: 86 }, { name: "Juventus", ovr: 83 }, { name: "Maccabi Haifa", ovr: 75 }]
};

const FORMATION_POSITIONS = {
  '4-3-3': [['LW', 'ST', 'RW'], ['CM', 'CM', 'CM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '4-4-2': [['ST', 'ST'], ['LM', 'CM', 'CM', 'RM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '4-2-3-1': [['ST'], ['LW', 'CAM', 'RW'], ['CDM', 'CDM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '3-5-2': [['ST', 'ST'], ['LM', 'CM', 'RM'], ['CDM', 'CDM'], ['CB', 'CB', 'CB'], ['GK']],
  '5-3-2': [['ST', 'ST'], ['CM', 'CM', 'CM'], ['LWB', 'CB', 'CB', 'CB', 'RWB'], ['GK']],
  '4-3-2-1': [['ST'], ['CAM', 'CAM'], ['CM', 'CM', 'CM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
};

export default function SeasonSimulator({ manager, squadOVR, availableTeams, activeLeague, draftedRoster, onRestart }) {
  const isUCL = activeLeague === "Champions League";
  const hasStarted = useRef(false);
  const totalUserGoals = useRef(0);

  // --- STATE ---
  const [leagueStats, setLeagueStats] = useState({ played: 0, totalGames: 38, wins: 0, draws: 0, losses: 0, points: 0, gf: 0, ga: 0 });
  const [uclStage, setUclStage] = useState("group"); 
  const [uclStatusText, setUclStatusText] = useState("Group Stage");
  const [groupTeams, setGroupTeams] = useState([]); 
  const [groupMatchesPlayed, setGroupMatchesPlayed] = useState(0);
  
  const [knockoutPool, setKnockoutPool] = useState([]); 
  const [knockoutOpponent, setKnockoutOpponent] = useState(null);
  const [currentLeg, setCurrentLeg] = useState(1); 
  const [leg1Score, setLeg1Score] = useState(null); 
  
  const [simStatus, setSimStatus] = useState("idle"); 
  const [matchLogs, setMatchLogs] = useState([]);
  const [finalVerdict, setFinalVerdict] = useState("");
  const [teamAwards, setTeamAwards] = useState(null);
  const [squadStatsLog, setSquadStatsLog] = useState([]);

  // --- MATCH SIMULATOR MATH ---
  const playMatch = (homeOVR, awayOVR, isNeutral = false) => {
    const homeBonus = isNeutral ? 0 : 2;
    const statDiff = (homeOVR + homeBonus) - awayOVR;
    
    const formFactor = Math.floor(Math.random() * 7) - 3; 
    const matchPower = statDiff + formFactor;

    let homeGoals = 0; let awayGoals = 0;

    if (matchPower > 6) {
      homeGoals = Math.floor(Math.random() * 4) + 1; 
      awayGoals = Math.floor(Math.random() * 2);     
    } else if (matchPower < -6) {
      homeGoals = Math.floor(Math.random() * 2);
      awayGoals = Math.floor(Math.random() * 4) + 1;
    } else {
      homeGoals = Math.floor(Math.random() * 3);
      awayGoals = Math.floor(Math.random() * 3);
      if (matchPower > 1 && homeGoals === awayGoals && Math.random() > 0.4) homeGoals += 1;
      if (matchPower < -1 && homeGoals === awayGoals && Math.random() > 0.4) awayGoals += 1;
    }
    return { myGoals: homeGoals, oppGoals: awayGoals };
  };

  // --- AWARDS GENERATOR ---
  const generateAwards = (totalGoals) => {
    const players = Object.values(draftedRoster || {});
    if (players.length === 0) return;

    const playerGoalsMap = {};
    players.forEach(p => { playerGoalsMap[p.id || p.player_name] = 0; });

    let remainingGoals = totalGoals;

    while (remainingGoals > 0) {
      for (let p of players) {
        if (remainingGoals <= 0) break;
        
        const posTokens = p.position.toUpperCase().split(',').map(s => s.trim());
        let scoreChance = 0.02; 

        if (posTokens.some(pos => ['ST', 'CF'].includes(pos))) scoreChance = 0.35;
        else if (posTokens.some(pos => ['RW', 'LW'].includes(pos))) scoreChance = 0.25;
        else if (posTokens.some(pos => ['RM', 'LM', 'CAM'].includes(pos))) scoreChance = 0.15;
        else if (posTokens.some(pos => ['CM', 'CDM'].includes(pos))) scoreChance = 0.08;

        scoreChance += (p.rating - 70) * 0.005;

        if (Math.random() < scoreChance) {
          playerGoalsMap[p.id || p.player_name]++;
          remainingGoals--;
        }
      }
    }

    const squadWithStats = players.map(p => ({
      ...p,
      goalsScored: playerGoalsMap[p.id || p.player_name] || 0,
      avgRating: (7.0 + (p.rating - 75) * 0.04 + Math.random() * 0.6).toFixed(2)
    })).sort((a, b) => b.goalsScored - a.goalsScored || b.rating - a.rating);

    const topScorer = squadWithStats[0];
    const mvp = [...squadWithStats].sort((a, b) => b.avgRating - a.avgRating)[0];

    setTeamAwards({
      topScorer: { player: topScorer, goals: topScorer.goalsScored },
      mvp: { player: mvp, rating: mvp.avgRating }
    });
    setSquadStatsLog(squadWithStats.filter(p => p.goalsScored > 0 || p.rating > 80).slice(0, 5));
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    if (!isUCL) runLeagueSimulation();
    else setupUclGroup();
  }, []);

  // ==========================================
  // 1. DOMESTIC LEAGUE MODE (38 GAMES)
  // ==========================================
  const runLeagueSimulation = () => {
    setSimStatus("simulating");
    
    const opponents = availableTeams.filter(t => t.club_name !== manager.teams.club_name).map(t => ({
      ...t,
      simOVR: Math.floor(Math.random() * (92 - 65 + 1)) + 65
    }));
    
    const fixtures = [...opponents, ...opponents].sort(() => Math.random() - 0.5);

    let currentWeek = 0;
    let temp = { played: 0, wins: 0, draws: 0, losses: 0, points: 0, gf: 0, ga: 0 };
    let accumulatedLogs = [];

    const interval = setInterval(() => {
      if (currentWeek >= fixtures.length) {
        clearInterval(interval);
        determineLeagueVerdict(temp.points, fixtures.length);
        generateAwards(temp.gf);
        setSimStatus("concluded");
        return;
      }

      const opp = fixtures[currentWeek];
      const oppOVR = opp.simOVR; 
      
      const isHomeFixture = currentWeek % 2 === 0;
      const { myGoals, oppGoals } = isHomeFixture 
        ? playMatch(squadOVR, oppOVR, false) 
        : playMatch(oppOVR, squadOVR, false);

      const userG = isHomeFixture ? myGoals : oppGoals;
      const oppG = isHomeFixture ? oppGoals : myGoals;

      temp.played++; temp.gf += userG; temp.ga += oppG;
      if (userG > oppG) { temp.wins++; temp.points += 3; }
      else if (userG < oppG) { temp.losses++; }
      else { temp.draws++; temp.points += 1; }

      accumulatedLogs = [{
        id: currentWeek, 
        title: isHomeFixture ? `vs ${opp.club_name} (H)` : `@ ${opp.club_name} (A)`, 
        score: `${userG} - ${oppG}`,
        result: userG > oppG ? 'W' : userG < oppG ? 'L' : 'D'
      }, ...accumulatedLogs];

      setLeagueStats({ ...temp, totalGames: fixtures.length });
      setMatchLogs(accumulatedLogs);
      currentWeek++;
    }, 100);
  };

  const determineLeagueVerdict = (pts, totalFixtures) => {
    const ppg = pts / totalFixtures; 
    if (ppg >= 2.2) setFinalVerdict("🏆 1st Place - LEAGUE CHAMPIONS!");
    else if (ppg >= 1.8) setFinalVerdict("🇪🇺 2nd - 4th Place - UCL Qualification Secured");
    else if (ppg >= 1.5) setFinalVerdict("🇪🇺 5th - 6th Place - Europa League Finish");
    else if (ppg >= 1.1) setFinalVerdict("📊 Mid-Table Finish - Safe & Stable");
    else if (ppg >= 0.9) setFinalVerdict("⚠️ Lower Mid-Table - Barely Escaped Relegation");
    else setFinalVerdict("📉 Relegation Zone - RELEGATED");
  };

  // ==========================================
  // 2. CHAMPIONS LEAGUE MODE
  // ==========================================
  const setupUclGroup = () => {
    let userTeamName = manager.teams.club_name;
    let allGroups = JSON.parse(JSON.stringify(UCL_2022_BASE)); 
    let userGrpKey = null;

    Object.keys(allGroups).forEach(key => {
      allGroups[key].forEach(t => { t.pts = 0; t.gf = 0; t.ga = 0; t.gd = 0; t.isUser = false; });
    });

    for (let key of Object.keys(allGroups)) {
      let team = allGroups[key].find(t => 
        t.name.toLowerCase().includes(userTeamName.toLowerCase()) || 
        userTeamName.toLowerCase().includes(t.name.toLowerCase()) ||
        (userTeamName === "PSG" && t.name === "Paris Saint-Germain")
      );
      if (team) {
        team.isUser = true; team.ovr = squadOVR; team.name = userTeamName; 
        userGrpKey = key; break;
      }
    }

    if (!userGrpKey) {
      allGroups['H'][3] = { name: userTeamName, ovr: squadOVR, pts: 0, gf: 0, ga: 0, gd: 0, isUser: true };
      userGrpKey = 'H';
    }

    setGroupTeams(allGroups[userGrpKey]);
    setSimStatus("simulating");
    runUclTournament(allGroups, userGrpKey);
  };

  const runUclTournament = (allGroups, userGrpKey) => {
    let matchday = 0;
    let accumulatedLogs = [];
    const schedule = [
      [[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]],
      [[1, 0], [3, 2]], [[2, 0], [3, 1]], [[3, 0], [2, 1]]
    ];

    const interval = setInterval(() => {
      if (matchday >= 6) {
        clearInterval(interval);
        
        let advancingAI = [];
        Object.keys(allGroups).forEach(grpKey => {
          let grp = allGroups[grpKey];
          grp.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
          if (grpKey !== userGrpKey) advancingAI.push(grp[0], grp[1]);
        });

        let userGrp = allGroups[userGrpKey];
        setGroupTeams([...userGrp]);
        
        const userIndex = userGrp.findIndex(t => t.isUser);
        if (userIndex <= 1) {
          if (userIndex === 0) advancingAI.push(userGrp[1]); else advancingAI.push(userGrp[0]);
          advancingAI.sort((a, b) => b.ovr - a.ovr);
          
          setUclStage("ro16"); setUclStatusText("Round of 16");
          setGroupMatchesPlayed(6);
          prepareNextKnockoutRound(advancingAI);
        } else {
          setFinalVerdict(`❌ Eliminated in Group Stage (${userIndex + 1}th Place)`);
          generateAwards(totalUserGoals.current);
          setSimStatus("concluded");
        }
        return;
      }

      Object.keys(allGroups).forEach(grpKey => {
        const grp = allGroups[grpKey];
        schedule[matchday].forEach(([h, a]) => {
          const { myGoals: gH, oppGoals: gA } = playMatch(grp[h].ovr, grp[a].ovr, false);
          grp[h].gf += gH; grp[h].ga += gA; grp[h].gd = grp[h].gf - grp[h].ga;
          grp[a].gf += gA; grp[a].ga += gH; grp[a].gd = grp[a].gf - grp[a].ga;

          if (gH > gA) grp[h].pts += 3; else if (gH < gA) grp[a].pts += 3;
          else { grp[h].pts += 1; grp[a].pts += 1; }

          if (grp[h].isUser || grp[a].isUser) {
            let myG = grp[h].isUser ? gH : gA; let oppG = grp[h].isUser ? gA : gH;
            totalUserGoals.current += myG;
            accumulatedLogs = [{
              id: `g-${matchday}`, title: `UCL Group - MD ${matchday + 1}`,
              score: grp[h].isUser ? `${myG} - ${oppG} vs ${grp[a].name} (H)` : `${myG} - ${oppG} @ ${grp[h].name} (A)`,
              result: myG > oppG ? 'W' : myG < oppG ? 'L' : 'D'
            }, ...accumulatedLogs];
          }
        });
      });

      setGroupTeams([...allGroups[userGrpKey]]);
      setMatchLogs([...accumulatedLogs]);
      setGroupMatchesPlayed(matchday + 1);
      matchday++;
    }, 400);
  };

  const prepareNextKnockoutRound = (poolList) => {
    const currentPool = poolList || knockoutPool;
    const opp = currentPool.pop(); 
    setKnockoutPool([...currentPool]);

    setKnockoutOpponent({ name: opp.name, ovr: opp.ovr });
    setCurrentLeg(1); setLeg1Score(null); setSimStatus("idle"); 
  };

  const simulateKnockoutStage = () => {
    setSimStatus("simulating");
    
    if (uclStage !== "final") {
      if (currentLeg === 1) {
        const { myGoals, oppGoals } = playMatch(knockoutOpponent.ovr, squadOVR, false);
        totalUserGoals.current += oppGoals; 
        setLeg1Score({ myGoals: oppGoals, oppGoals: myGoals });
        
        setMatchLogs(prev => [{
          id: `${uclStage}-l1`, title: `${uclStatusText} - Leg 1 (A)`,
          score: `${oppGoals} - ${myGoals} @ ${knockoutOpponent.name}`,
          result: oppGoals > myGoals ? 'W' : oppGoals < myGoals ? 'L' : 'D'
        }, ...prev]);

        setCurrentLeg(2); setSimStatus("idle");
      } else {
        const { myGoals: mG2, oppGoals: oG2 } = playMatch(squadOVR, knockoutOpponent.ovr, false);
        let finalMy = leg1Score.myGoals + mG2;
        let finalOpp = leg1Score.oppGoals + oG2;

        if (finalMy === finalOpp) {
          if (Math.random() > 0.5) finalMy += 1; else finalOpp += 1;
        }

        totalUserGoals.current += mG2;

        setMatchLogs(prev => [{
          id: `${uclStage}-l2`, title: `${uclStatusText} - Leg 2 (H)`,
          score: `${mG2} - ${oG2} (Agg: ${finalMy} - ${finalOpp})`,
          result: finalMy > finalOpp ? 'W' : 'L'
        }, ...prev]);

        if (finalMy > finalOpp) {
          if (uclStage === "ro16") { setUclStage("qf"); setUclStatusText("Quarter-Finals"); prepareNextKnockoutRound(); } 
          else if (uclStage === "qf") { setUclStage("sf"); setUclStatusText("Semi-Finals"); prepareNextKnockoutRound(); } 
          else if (uclStage === "sf") {
            setUclStage("final"); setUclStatusText("UCL Grand Final");
            setKnockoutOpponent(knockoutPool[0] || { name: "Real Madrid", ovr: 89 });
            setCurrentLeg(1); setSimStatus("idle");
          }
        } else {
          setFinalVerdict(`❌ Eliminated in the ${uclStatusText}`);
          generateAwards(totalUserGoals.current);
          setSimStatus("concluded");
        }
      }
    } else {
      const { myGoals, oppGoals } = playMatch(squadOVR, knockoutOpponent.ovr, true);
      let finalMy = myGoals; let finalOpp = oppGoals;
      if (myGoals === oppGoals) { if (Math.random() > 0.5) finalMy += 1; else finalOpp += 1; }
      totalUserGoals.current += finalMy;

      setMatchLogs(prev => [{
        id: "ucl-final", title: `🏆 UCL GRAND FINAL`,
        score: `${finalMy} - ${finalOpp} vs ${knockoutOpponent.name}`, result: finalMy > finalOpp ? 'W' : 'L'
      }, ...prev]);

      if (finalMy > finalOpp) setFinalVerdict("🏆 CHAMPIONS OF EUROPE! Your team lifted the trophy!");
      else setFinalVerdict("🥈 Champions League Runners-Up. Heartbreak in the final.");
      
      generateAwards(totalUserGoals.current);
      setSimStatus("concluded");
    }
  };

  const rosterRows = FORMATION_POSITIONS[manager.formation] || FORMATION_POSITIONS['4-3-3'];

  return (
    <div className="min-h-screen bg-black text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-900 pb-4">
          <h2 className="text-3xl font-black text-white tracking-tight">{activeLeague} Campaign</h2>
          {simStatus === 'concluded' && (
            <button
              onClick={onRestart}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              Start New Setup
            </button>
          )}
        </div>

        {/* TOP DASHBOARD: TACTICAL PITCH & VERDICT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* LEFT COLUMN: THE MINI PITCH */}
          <div className="lg:col-span-1 bg-[#050505] border border-slate-800 rounded-2xl p-5 flex flex-col items-center shadow-lg relative overflow-hidden">
            <div className="w-full flex justify-between items-start mb-5 z-10">
              <div className="overflow-hidden pr-2">
                <h3 className="text-lg font-black text-white uppercase tracking-wide truncate">{manager.teams.club_name}</h3>
                <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest truncate mt-0.5">
                  {manager.manager_name} • {manager.formation}
                </p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded flex flex-col items-center shrink-0">
                <span className="text-emerald-400 font-black text-xl leading-none">{squadOVR}</span>
                <span className="text-emerald-400/80 font-bold text-[8px] uppercase tracking-widest mt-1">OVR</span>
              </div>
            </div>

            <div className="relative w-full max-w-[280px] bg-[#0a1f11] border-[4px] border-[#050f08] rounded aspect-[3/4] flex flex-col justify-between p-3 overflow-hidden shadow-inner z-10">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-1/2 w-20 h-20 border-2 border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute top-0 left-1/2 w-1/2 h-12 border-2 border-t-0 border-white/10 -translate-x-1/2"></div>
                <div className="absolute bottom-0 left-1/2 w-1/2 h-12 border-2 border-b-0 border-white/10 -translate-x-1/2"></div>
              </div>

              {rosterRows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-2 sm:gap-4 w-full z-10">
                  {row.map((position, colIndex) => {
                    const player = draftedRoster[`${rowIndex}-${colIndex}`];
                    return (
                      <div key={colIndex} className="relative flex flex-col items-center justify-center w-[45px]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-lg transition-all
                          ${player ? 'bg-[#050505] text-emerald-400 border-emerald-500' : 'bg-black/50 text-slate-600 border-slate-800'}`}>
                          {player ? player.rating : position}
                        </div>
                        {player && (
                          <span className="text-white font-bold text-[9px] mt-1 text-center w-full truncate bg-black/60 px-1 rounded shadow-sm">
                            {player.player_name.split(' ').pop()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMNS: VERDICT & AWARDS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {simStatus === "concluded" && teamAwards ? (
              <>
                <div className="bg-[#050505] border-2 border-emerald-500 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-fade-in flex-1 flex flex-col justify-center items-center text-center">
                  <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2">Campaign Report Card</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-snug">{finalVerdict}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
                  <div className="bg-[#050505] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group hover:border-yellow-500/50 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                    <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center font-black text-xl text-yellow-500 shrink-0">
                      {teamAwards.mvp.player.rating}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-yellow-500 font-bold text-[10px] uppercase tracking-widest mb-0.5">Player of the Season</p>
                      <h3 className="text-white font-black text-lg sm:text-xl truncate">{teamAwards.mvp.player.player_name}</h3>
                      <p className="text-slate-400 font-bold text-xs">Avg Match Rating: <span className="text-white">{teamAwards.mvp.rating}</span></p>
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-black text-xl text-emerald-400 shrink-0">
                      {teamAwards.topScorer.player.rating}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest mb-0.5">Golden Boot</p>
                      <h3 className="text-white font-black text-lg sm:text-xl truncate">{teamAwards.topScorer.player.player_name}</h3>
                      <p className="text-slate-400 font-bold text-xs">Goals Scored: <span className="text-white">{teamAwards.topScorer.goals}</span></p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 bg-[#050505] border border-slate-800 rounded-2xl flex flex-col items-center justify-center min-h-[250px] p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 animate-pulse"></div>
                <span className="text-emerald-400 text-5xl mb-4 animate-bounce">⚽</span>
                <h3 className="text-2xl font-black text-white">Simulating Matchdays...</h3>
                <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest">Processing tactical data</p>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM DASHBOARD: STATS, STANDINGS & LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {!isUCL && (
              <div className="bg-[#050505] border border-slate-800 p-6 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center border-r border-slate-900 last:border-0">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Record</p>
                  <p className="text-xl font-black text-white mt-1">
                    {leagueStats.wins}W - {leagueStats.draws}D - {leagueStats.losses}L
                  </p>
                </div>
                <div className="text-center sm:border-r border-slate-900 last:border-0">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Matches</p>
                  <p className="text-xl font-black text-white mt-1">{leagueStats.played} / {leagueStats.totalGames}</p>
                </div>
                <div className="text-center border-r border-slate-900 last:border-0">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Goals (GD)</p>
                  <p className="text-xl font-black text-white mt-1">{leagueStats.gf}:{leagueStats.ga} ({leagueStats.gf - leagueStats.ga})</p>
                </div>
                <div className="text-center bg-emerald-500/5 rounded-xl py-1 border border-emerald-500/20">
                  <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Points</p>
                  <p className="text-2xl font-black text-emerald-400 mt-0.5">{leagueStats.points}</p>
                </div>
              </div>
            )}

            {isUCL && (
              <div className="flex flex-col gap-6">
                <div className="bg-[#050505] border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Tournament Phase</span>
                  <span className="bg-emerald-500/20 text-emerald-400 font-black text-xs px-3 py-1 rounded border border-emerald-500/30 uppercase tracking-widest">
                    {uclStatusText}
                  </span>
                </div>

                {uclStage === "group" && (
                  <div className="bg-[#050505] border border-slate-800 rounded-2xl p-5 sm:p-6">
                    <h3 className="text-white font-black text-base mb-4">Group Standings ({groupMatchesPlayed}/6 MD)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-900 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                            <th className="pb-3 pl-2">Club</th>
                            <th className="pb-3 text-center">OVR</th>
                            <th className="pb-3 text-center">GD</th>
                            <th className="pb-3 text-center pr-2">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/50">
                          {groupTeams.map((team, idx) => (
                            <tr key={idx} className={`h-11 ${team.isUser ? 'bg-emerald-500/5 font-bold' : ''}`}>
                              <td className="pl-2 flex items-center h-11">
                                <span className={`mr-2.5 font-black text-xs w-4 ${idx < 2 ? 'text-emerald-400' : 'text-slate-600'}`}>{idx + 1}</span>
                                <span className={team.isUser ? 'text-emerald-400 font-black' : 'text-slate-200'}>{team.name}</span>
                              </td>
                              <td className="text-center text-slate-400 text-xs">{team.ovr}</td>
                              <td className={`text-center font-bold text-xs ${team.gd > 0 ? 'text-emerald-400' : team.gd < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                {team.gd > 0 ? `+${team.gd}` : team.gd}
                              </td>
                              <td className={`text-center font-black text-sm pr-2 ${team.isUser ? 'text-emerald-400' : 'text-white'}`}>{team.pts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {uclStage !== "group" && simStatus !== "concluded" && knockoutOpponent && (
                  <div className="bg-[#050505] border-2 border-slate-800 p-6 rounded-2xl text-center relative overflow-hidden">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Upcoming Matchup</p>
                    <div className="flex justify-center items-center gap-6 my-4">
                      <div>
                        <h4 className="text-xl font-black text-emerald-400">{manager.teams.club_name}</h4>
                        <span className="text-slate-500 text-xs font-bold">OVR {squadOVR}</span>
                      </div>
                      <span className="text-slate-700 font-black text-xl italic">VS</span>
                      <div>
                        <h4 className="text-xl font-black text-white">{knockoutOpponent.name}</h4>
                        <span className="text-slate-500 text-xs font-bold">OVR {knockoutOpponent.ovr}</span>
                      </div>
                    </div>
                    
                    {uclStage !== "final" && (
                      <p className="text-xs font-medium text-slate-400 mb-6 bg-black/40 border border-slate-900 py-1.5 px-4 rounded-full w-fit mx-auto">
                        {currentLeg === 2 ? `🔄 Second Leg (Aggregate Decider at Home)` : `🗓️ First Leg Ties (Away)`}
                      </p>
                    )}

                    {simStatus === "idle" && (
                      <button
                        onClick={simulateKnockoutStage}
                        className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black rounded-xl transition-transform active:scale-95 shadow-md shadow-emerald-500/10 uppercase text-sm tracking-wider"
                      >
                        {uclStage === "final" ? "Simulate Final Match 🏆" : `Kickoff Leg ${currentLeg}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SQUAD HIGHLIGHT STATS SECTION */}
            {simStatus === "concluded" && squadStatsLog.length > 0 && (
              <div className="bg-[#050505] border border-slate-800 rounded-2xl p-5 sm:p-6 animate-fade-in">
                <h3 className="text-white font-black text-base mb-4">Top Performer Squad Statistics</h3>
                <div className="space-y-3">
                  {squadStatsLog.map((player, idx) => (
                    <div key={idx} className="bg-black/40 border border-slate-900 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm">{player.player_name}</p>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{player.position} • OVR {player.rating}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-black text-sm">{player.goalsScored} Goals</p>
                        <p className="text-slate-400 text-xs font-medium">Rating: {player.avgRating}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR PANEL: LIVE TICKER FEED LIST LOG */}
          <div className="bg-[#050505] border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col h-[420px]">
            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4 flex justify-between items-center shrink-0">
              <span>Match Ticker Logs</span>
              {simStatus === "simulating" && <span className="text-emerald-400 animate-pulse text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">● Simulating</span>}
            </h3>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 custom-scrollbar relative">
              {matchLogs.length === 0 && (
                <div className="text-slate-600 font-bold italic text-center py-12 text-sm">Waiting for kickoff whistle...</div>
              )}
              {matchLogs.map((log) => (
                <div key={log.id} className="bg-black border border-slate-900 p-3 rounded-xl flex items-center justify-between animate-slide-in">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center shrink-0
                      ${log.result === 'W' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : log.result === 'L' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-900 text-slate-400'}`}>
                      {log.result}
                    </span>
                    <div className="truncate">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{log.title}</p>
                      <p className="text-white font-bold text-xs mt-0.5 truncate">{log.score}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none z-10"></div>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slide-in { animation: slideIn 0.25s ease-out forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}} />
    </div>
  );
}