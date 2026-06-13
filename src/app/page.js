"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import SeasonSimulator from "../components/SeasonSimulator";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const LEAGUES = [
  { id: "Champions League", uiName: "🏆 Champions League" },
  { id: "Premier League", uiName: "Premier League" },
  { id: "La Liga", uiName: "La Liga" },
  { id: "Bundesliga", uiName: "Bundesliga" },
  { id: "Serie A", uiName: "Serie A" },
  { id: "Ligue 1", uiName: "Ligue 1" },
];

const FORMATION_POSITIONS = {
  '4-3-3': [['LW', 'ST', 'RW'], ['CM', 'CM', 'CM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '4-4-2': [['ST', 'ST'], ['LM', 'CM', 'CM', 'RM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '4-2-3-1': [['ST'], ['LW', 'CAM', 'RW'], ['CDM', 'CDM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '3-5-2': [['ST', 'ST'], ['LM', 'CM', 'RM'], ['CDM', 'CDM'], ['CB', 'CB', 'CB'], ['GK']],
  '5-3-2': [['ST', 'ST'], ['CM', 'CM', 'CM'], ['LWB', 'CB', 'CB', 'CB', 'RWB'], ['GK']],
  '4-3-2-1': [['ST'], ['CAM', 'CAM'], ['CM', 'CM', 'CM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
};

const POS_ATTACK = ['ST', 'CF', 'RW', 'LW', 'RM', 'LM'];
const POS_MID = ['CM', 'CDM', 'CAM', 'RM', 'LM', 'RW', 'LW'];
const POS_DEF = ['CB', 'RB', 'LB', 'RWB', 'LWB'];
const POS_GK = ['GK'];

const getPlayerPositions = (posString) => {
  if (!posString) return [];
  let positions = posString.split(',').map(s => s.trim().toUpperCase());

  positions = positions.map(pos => {
    if (pos === 'RS' || pos === 'RF') return 'RW';
    if (pos === 'LS' || pos === 'LF') return 'LW';
    return pos;
  });

  return Array.from(new Set(positions));
};

const isUCLTeam = (clubName) => {
  if (!clubName) return false;
  const name = clubName.toLowerCase();
  const uclKeywords = [
    "arsenal", "manchester city", "man city", "liverpool", "chelsea",
    "real madrid", "barcelona", "atlético", "atletico", "sevilla",
    "bayern", "dortmund", "leipzig", "leverkusen",
    "milan", "inter", "napoli", "juventus", "piemonte",
    "paris", "psg", "marseille", "monaco", "lyon"
  ];
  return uclKeywords.some(keyword => name.includes(keyword));
};

const VERSATILITY_MAP = {
  'RW': ['RM'],
  'RM': ['RW'],
  'LW': ['LM'],
  'LM': ['LW'],
  'CAM': ['CM'],
  'CM': ['CAM', 'CDM'],
  'CDM': ['CM'],
  'ST': ['CF'],
  'CF': ['ST'],
  'LWB': ['LB', 'LM'],
  'RWB': ['RB', 'RM'],
  'LB': ['LWB'],
  'RB': ['RWB'],
};

const expandPositions = (posString) => {
  const basePositions = getPlayerPositions(posString);
  const expanded = new Set(basePositions);

  basePositions.forEach(pos => {
    if (VERSATILITY_MAP[pos]) {
      VERSATILITY_MAP[pos].forEach(alt => expanded.add(alt));
    }
  });

  return Array.from(expanded);
};

export default function DraftGame() {
  const [managers, setManagers] = useState([]);
  const [selectedFormation, setSelectedFormation] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [activeLeague, setActiveLeague] = useState("Champions League");
  const [isDrafting, setIsDrafting] = useState(false);

  const [spinResult, setSpinResult] = useState({ teamId: null, teamName: "???", year: "2023" });
  const [isSpinning, setIsSpinning] = useState(false);
  const [spunTeams, setSpunTeams] = useState(new Set());
  const [draftedRoster, setDraftedRoster] = useState({});
  const [pendingPlayer, setPendingPlayer] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('Attack');
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [fetchingPlayers, setFetchingPlayers] = useState(false);

  // The Bridge State
  const [isSeasonMode, setIsSeasonMode] = useState(false);
  const [finalSquadOVR, setFinalSquadOVR] = useState(0);

  useEffect(() => {
    async function fetchManagers() {
      const { data, error } = await supabase
        .from("managers")
        .select(`id, manager_name, formation, teams ( id, club_name, league )`)
        .order("manager_name");

      if (error) console.error("Error fetching managers:", error);
      else setManagers(data || []);
      setLoading(false);
    }
    fetchManagers();
  }, []);

  const filteredManagers = managers.filter((m) => {
    if (!m.teams) return false;
    const dbLeague = String(m.teams.league || "").toLowerCase();
    const dbClub = String(m.teams.club_name || "").toLowerCase();

    if (activeLeague === "Champions League") return isUCLTeam(dbClub);

    if (activeLeague === "Premier League") return dbLeague.includes("premier") || dbLeague.includes("english");
    if (activeLeague === "La Liga") return (dbLeague.includes("liga") || dbLeague.includes("spain") || dbLeague.includes("primera")) && !dbLeague.includes("bundesliga");
    if (activeLeague === "Bundesliga") return dbLeague.includes("bundesliga") || dbLeague.includes("german");
    if (activeLeague === "Serie A") return dbLeague.includes("serie a") || dbLeague.includes("italy");
    if (activeLeague === "Ligue 1") return dbLeague.includes("ligue 1") || dbLeague.includes("french");
    return false;
  });

  const availableTeams = Array.from(
    new Map(
      filteredManagers
        .filter((m) => m.teams)
        .map((m) => [m.teams.id, m.teams])
    ).values()
  );

  const handleSpin = () => {
    const unspunTeams = availableTeams.filter(t => !spunTeams.has(t.id));
    if (isSpinning || unspunTeams.length === 0) return;

    setIsSpinning(true);
    let spins = 0;
    let finalTeam = null;

    const interval = setInterval(() => {
      const randomTeam = unspunTeams[Math.floor(Math.random() * unspunTeams.length)];
      setSpinResult({ teamId: randomTeam.id, teamName: randomTeam.club_name, year: "2023" });
      finalTeam = randomTeam;
      spins++;
      if (spins >= 20) {
        clearInterval(interval);
        setIsSpinning(false);
        setSpunTeams(prev => new Set([...prev, finalTeam.id]));
      }
    }, 100);
  };

  const openScoutNetwork = async () => {
    setIsModalOpen(true);
    setFetchingPlayers(true);
    setModalTab('Attack');

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', spinResult.teamId)
      .order('rating', { ascending: false });

    if (!error) setTeamPlayers(data || []);
    setFetchingPlayers(false);
  };

  const handleSelectPlayer = (player) => {
    setPendingPlayer(player);
    setIsModalOpen(false);
  };

  const handleSlotClick = (slotKey, isPlaceable) => {
    if (!pendingPlayer || !isPlaceable) return;

    setDraftedRoster((prev) => ({ ...prev, [slotKey]: pendingPlayer }));
    setPendingPlayer(null);
    setSpinResult({ teamId: null, teamName: "???", year: "2023" });
  };

  const canPlacePlayer = (player, slotPositionName) => {
    if (!player) return false;
    const positions = expandPositions(player.position);
    return positions.includes(slotPositionName);
  };

  const filteredTeamPlayers = teamPlayers.filter(p => {
    const positions = expandPositions(p.position);
    if (modalTab === 'Attack') return positions.some(pos => POS_ATTACK.includes(pos));
    if (modalTab === 'Mid') return positions.some(pos => POS_MID.includes(pos));
    if (modalTab === 'Defense') return positions.some(pos => POS_DEF.includes(pos));
    if (modalTab === 'GK') return positions.some(pos => POS_GK.includes(pos));
    return false;
  });

  const groupedManagers = filteredManagers.reduce((acc, m) => {
    const form = m.formation || "Unknown";
    if (!acc[form]) acc[form] = [];
    acc[form].push(m);
    return acc;
  }, {});
  
  const sortedFormations = Object.keys(groupedManagers).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-bold">
        Loading Career Mode...
      </div>
    );
  }

  // --- RENDER THE BRIDGE: SEASON SIMULATOR COMPONENT ---
  if (isSeasonMode) {
    return (
      <SeasonSimulator 
        manager={selectedManager}
        squadOVR={finalSquadOVR}
        availableTeams={availableTeams}
        activeLeague={activeLeague}
        draftedRoster={draftedRoster}
        onRestart={() => {
          setIsSeasonMode(false);
          setSelectedManager(null);
          setSelectedFormation(null);
          setDraftedRoster({});
          setSpunTeams(new Set());
        }}
      />
    );
  }

  // --- RENDER: DRAFT PITCH MODE ---
  if (isDrafting && selectedManager) {
    const rosterRows = FORMATION_POSITIONS[selectedManager.formation] || FORMATION_POSITIONS['4-3-3'];

    const remainingPositionsCount = {};
    let totalRemaining = 0;
    let benchRemaining = 3; 

    rosterRows.forEach((row, rowIndex) => {
      row.forEach((position, colIndex) => {
        const slotKey = `${rowIndex}-${colIndex}`;
        if (!draftedRoster[slotKey]) {
          remainingPositionsCount[position] = (remainingPositionsCount[position] || 0) + 1;
          totalRemaining++;
        }
      });
    });

    [0, 1, 2].forEach(i => {
      if (draftedRoster[`bench-${i}`]) benchRemaining--;
    });

    if (benchRemaining > 0) {
      remainingPositionsCount['SUB'] = benchRemaining;
      totalRemaining += benchRemaining;
    }

    let squadOVR = 0;
    const starting11 = Object.entries(draftedRoster)
      .filter(([key]) => !key.startsWith('bench')) 
      .map(([, p]) => p.rating);

    if (starting11.length > 0) {
      const sum = starting11.reduce((a, b) => a + b, 0);
      const avg = sum / starting11.length;
      
      let correction = 0;
      starting11.forEach(rating => {
        if (rating > avg) correction += (rating - avg); 
      });
      
      squadOVR = Math.round(avg + (correction / starting11.length));
    }

    const unspunTeams = availableTeams.filter(t => !spunTeams.has(t.id));
    const allTeamsExhausted = unspunTeams.length === 0;

    return (
      <div className="min-h-screen bg-black text-slate-200 p-4 md:p-8 font-sans relative">
        <div className="max-w-6xl mx-auto">

          {/* TOP CONSOLE */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch gap-4 mb-8">

            <div className="bg-[#050505] border border-slate-800 p-5 sm:p-6 rounded-2xl flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start gap-2">
                <div className="overflow-hidden">
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 leading-tight truncate">{selectedManager.manager_name}</h2>
                  <p className="text-emerald-400 font-bold uppercase tracking-wider text-xs sm:text-sm truncate">
                    {selectedManager.teams?.club_name} • {selectedManager.formation}
                  </p>
                </div>
                
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 sm:px-4 py-2 flex flex-col items-center justify-center shrink-0">
                  <span className="text-emerald-400 font-black text-xl sm:text-2xl leading-none">
                    {squadOVR > 0 ? squadOVR : '--'}
                  </span>
                  <span className="text-emerald-400/80 font-bold text-[8px] sm:text-[10px] uppercase tracking-widest mt-1">
                    Starting OVR
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setIsDrafting(false);
                  setDraftedRoster({});
                  setPendingPlayer(null);
                  setSpunTeams(new Set());
                }}
                className="mt-6 px-4 py-2 bg-[#111] hover:bg-slate-800 border border-slate-800 rounded-lg font-bold text-xs sm:text-sm transition-colors w-fit shrink-0"
              >
                ← Resign & Reset
              </button>
            </div>

            <div className="bg-[#050505] border border-slate-800 p-5 sm:p-6 rounded-2xl flex-1 flex flex-col min-w-[200px]">
              <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2 shrink-0">
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest truncate mr-2">Positions Remaining</p>
                <span className={`px-2 py-1 rounded font-black text-xs border shrink-0 ${totalRemaining === 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-black text-emerald-400 border-slate-800'}`}>
                  {totalRemaining} Left
                </span>
              </div>
              <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[120px] custom-scrollbar pr-1 content-start">
                {totalRemaining === 0 ? (
                  <button 
                    onClick={() => {
                      setFinalSquadOVR(squadOVR);
                      setIsDrafting(false);
                      setIsSeasonMode(true);
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
                  >
                    START SEASON SIMULATION 🏆
                  </button>
                ) : (
                  Object.entries(remainingPositionsCount).map(([pos, count]) => (
                    <div key={pos} className="bg-black border border-slate-800 px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                      <span className="text-emerald-400 font-black text-xs">{pos}</span>
                      <span className="bg-[#111] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">x{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-[#050505] border-2 border-emerald-500/30 p-5 sm:p-6 rounded-2xl flex flex-col items-center justify-center w-full lg:w-[340px] shrink-0 lg:flex-none shadow-[0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

              {pendingPlayer ? (
                <div className="text-center animate-pulse w-full flex flex-col items-center">
                  <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1">Deploy Player</p>
                  
                  <div className="h-[40px] sm:h-[48px] flex items-center justify-center w-full">
                    <h3 className="text-xl sm:text-2xl font-black text-white w-full truncate px-2">{pendingPlayer.player_name}</h3>
                  </div>

                  <div className="mt-1 flex justify-center gap-2 items-center flex-wrap">
                    <span className="bg-black px-3 py-1 rounded text-emerald-400 font-bold border border-slate-800 text-[10px] sm:text-xs">
                      ({expandPositions(pendingPlayer.position).join(', ')})
                    </span>
                    <span className="bg-emerald-500/20 px-3 py-1 rounded text-emerald-400 font-bold border border-emerald-500/50 text-[10px] sm:text-xs">
                      {pendingPlayer.rating} OVR
                    </span>
                  </div>
                  <button
                    onClick={() => setPendingPlayer(null)}
                    className="mt-4 text-[10px] sm:text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase"
                  >
                    Cancel Pick
                  </button>
                </div>
              ) : spinResult.teamId ? (
                <div className="text-center w-full flex flex-col items-center">
                  <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1">Constraint Locked</p>
                  
                  <div className="h-[40px] sm:h-[48px] flex items-center justify-center w-full mb-3">
                    <h3 className="text-xl sm:text-2xl font-black text-white w-full truncate px-2">{spinResult.teamName}</h3>
                  </div>

                  <button
                    onClick={openScoutNetwork}
                    className="w-full py-2.5 sm:py-3 rounded-lg font-black text-sm sm:text-base bg-emerald-500 text-black hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    SCOUT PLAYERS
                  </button>
                </div>
              ) : (
                <div className="text-center w-full flex flex-col items-center">
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Draft Constraint</p>
                  <div className={`mb-3 sm:mb-4 transition-transform w-full ${isSpinning ? 'scale-110 opacity-70' : 'scale-100'}`}>
                    
                    <div className="h-[40px] sm:h-[48px] flex items-center justify-center w-full">
                      <h3 className="text-xl sm:text-2xl font-black text-white w-full truncate px-2">{spinResult.teamName}</h3>
                    </div>
                    <p className="text-sm sm:text-xl text-emerald-400 font-bold mt-1">Season: {spinResult.year}</p>

                  </div>
                  <p className="text-slate-500 text-[10px] font-bold mb-3 uppercase tracking-wider">
                    {availableTeams.length - unspunTeams.length} / {availableTeams.length} teams spun
                  </p>
                  <button
                    onClick={handleSpin}
                    disabled={isSpinning || allTeamsExhausted}
                    className="w-full py-2.5 sm:py-3 rounded-lg font-black text-sm sm:text-base bg-[#111] border border-slate-800 text-white hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                  >
                    {isSpinning ? "SPINNING..." : allTeamsExhausted ? "ALL TEAMS SPUN" : "SPIN FOR TEAM"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* THE STARTING XI PITCH */}
          <div className="relative w-full max-w-4xl mx-auto bg-[#0a1f11] border-[10px] border-[#050f08] rounded-t-lg aspect-[3/4] sm:aspect-[4/5] flex flex-col justify-between p-4 sm:p-10 overflow-hidden shadow-2xl">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-40 h-40 border-4 border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-0 left-1/2 w-3/5 h-32 border-4 border-t-0 border-white/10 -translate-x-1/2"></div>
              <div className="absolute bottom-0 left-1/2 w-3/5 h-32 border-4 border-b-0 border-white/10 -translate-x-1/2"></div>
            </div>

            {rosterRows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-2 sm:gap-6 w-full z-10">
                {row.map((position, colIndex) => {
                  const slotKey = `${rowIndex}-${colIndex}`;
                  const draftedPlayer = draftedRoster[slotKey];

                  const isValidTarget = canPlacePlayer(pendingPlayer, position);
                  const isPlaceable = pendingPlayer && !draftedPlayer && isValidTarget;
                  const isUnplaceable = pendingPlayer && !draftedPlayer && !isValidTarget;

                  return (
                    <div
                      key={colIndex}
                      onClick={() => handleSlotClick(slotKey, isPlaceable)}
                      className={`relative rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center w-[85px] sm:w-[110px] h-[110px] sm:h-[130px] flex-shrink-0 box-border shadow-xl transition-all overflow-hidden ${
                        draftedPlayer
                          ? "bg-[#050505] border-2 border-emerald-500"
                          : isPlaceable
                            ? "bg-emerald-500/20 border-2 border-dashed border-emerald-400 cursor-pointer hover:bg-emerald-500/40 hover:-translate-y-2 animate-pulse z-20 group"
                            : isUnplaceable
                            ? "bg-red-900/20 border-2 border-dashed border-red-900/30 opacity-40 cursor-not-allowed"
                            : "bg-[#050505]/80 backdrop-blur-sm border-2 border-slate-800/80 opacity-60"
                      }`}
                    >
                      {draftedPlayer ? (
                        <>
                          <div className="absolute top-1 sm:top-2 left-2 text-emerald-400 font-black text-sm sm:text-lg">{draftedPlayer.rating}</div>
                          <div className="mt-4 text-center font-bold text-white text-[10px] sm:text-sm leading-tight px-1 w-full truncate">
                            {draftedPlayer.player_name}
                          </div>
                          <div className="absolute bottom-1 right-1 text-slate-500 font-bold text-[8px] sm:text-[9px] w-full text-right pr-1 truncate">
                            ({expandPositions(draftedPlayer.position).join(', ')})
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-full flex items-center justify-center font-black text-sm sm:text-base border border-slate-800 mb-2 transition-colors ${isPlaceable ? 'text-emerald-400 border-emerald-500 group-hover:bg-emerald-500 group-hover:text-black' : isUnplaceable ? 'text-red-500 border-red-900' : 'text-slate-600'}`}>
                            {position}
                          </div>
                          <button className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider text-center leading-tight ${isPlaceable ? 'text-emerald-400 group-hover:text-white' : isUnplaceable ? 'text-red-500' : 'text-slate-600'}`}>
                            {isPlaceable ? "Place Here" : isUnplaceable ? "Locked" : "Empty"}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* THE DUGOUT (Universal Bench Slots) */}
          <div className="w-full max-w-4xl mx-auto bg-[#050505] border-x-[10px] border-b-[10px] border-[#0a0a0a] rounded-b-lg flex flex-col items-center p-4 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 w-full h-px bg-slate-800/50"></div>
            <h3 className="text-slate-600 font-black text-xs sm:text-sm uppercase tracking-widest mb-4">Substitutes</h3>
            
            <div className="flex justify-center gap-3 sm:gap-6 w-full z-10">
              {[0, 1, 2].map((index) => {
                const slotKey = `bench-${index}`;
                const draftedPlayer = draftedRoster[slotKey];
                
                const isPlaceable = !!pendingPlayer && !draftedPlayer;

                return (
                  <div
                    key={index}
                    onClick={() => handleSlotClick(slotKey, isPlaceable)}
                    className={`relative rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center w-[85px] sm:w-[110px] h-[110px] sm:h-[130px] flex-shrink-0 box-border shadow-xl transition-all overflow-hidden ${
                      draftedPlayer
                        ? "bg-[#111] border-2 border-slate-700"
                        : isPlaceable
                          ? "bg-slate-800/30 border-2 border-dashed border-emerald-500/50 cursor-pointer hover:bg-slate-800 hover:-translate-y-2 animate-pulse z-20 group"
                          : "bg-[#0a0a0a] border-2 border-slate-800/50"
                    }`}
                  >
                    {draftedPlayer ? (
                      <>
                        <div className="absolute top-1 sm:top-2 left-2 text-white font-black text-sm sm:text-lg">{draftedPlayer.rating}</div>
                        <div className="mt-4 text-center font-bold text-slate-300 text-[10px] sm:text-sm leading-tight px-1 w-full truncate">
                          {draftedPlayer.player_name}
                        </div>
                        <div className="absolute bottom-1 right-1 text-slate-500 font-bold text-[8px] sm:text-[9px] w-full text-right pr-1 truncate">
                          ({expandPositions(draftedPlayer.position).join(', ')})
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs border border-slate-800 mb-2 transition-colors ${isPlaceable ? 'text-emerald-400 border-emerald-500 group-hover:bg-emerald-500 group-hover:text-black' : 'text-slate-700'}`}>
                          SUB
                        </div>
                        <button className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider text-center leading-tight ${isPlaceable ? 'text-emerald-400 group-hover:text-white' : 'text-slate-700'}`}>
                          {isPlaceable ? "Place Here" : "Empty"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* --- DRAFT MODAL --- */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#050505] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">

              <div className="p-4 sm:p-6 bg-[#0a0a0a] border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">Scouting {spinResult.teamName}</h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">Select a player to lock into your hand.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white font-bold text-2xl p-2 leading-none">✕</button>
              </div>

              <div
                className="bg-[#050505] px-4 sm:px-6 py-2 sm:py-2.5 border-b border-slate-800 flex items-center gap-1.5 sm:gap-2 overflow-x-auto hide-scroll"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <style dangerouslySetInnerHTML={{__html: `.hide-scroll::-webkit-scrollbar { display: none; }`}} />
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap mr-1">Remaining:</span>
                {totalRemaining === 0 ? (
                  <span className="text-emerald-400 font-black text-[10px] whitespace-nowrap">SQUAD COMPLETE 🏆</span>
                ) : (
                  Object.entries(remainingPositionsCount).map(([pos, count]) => (
                    <div key={pos} className="bg-black border border-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 shadow-sm">
                      <span className="text-emerald-400 font-black text-[9px] sm:text-[10px] leading-none">{pos}</span>
                      <span className="bg-[#111] text-white text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded leading-none">x{count}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-4 bg-[#0a0a0a] border-b border-slate-800">
                {['Attack', 'Mid', 'Defense', 'GK'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setModalTab(tab)}
                    className={`py-3 sm:py-4 text-xs sm:text-sm font-bold transition-colors text-center ${modalTab === tab ? "bg-[#111] text-emerald-400 border-b-2 border-emerald-400" : "text-slate-500 hover:bg-[#111]"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto p-4 flex-1 bg-[#050505] custom-scrollbar">
                {fetchingPlayers ? (
                  <div className="text-center py-10 text-emerald-400 font-bold animate-pulse">Scouting players...</div>
                ) : filteredTeamPlayers.length === 0 ? (
                  <div className="text-center py-10 text-slate-600 italic">No players found for this category.</div>
                ) : (
                  <div className="grid gap-2">
                    {filteredTeamPlayers.map(player => {
                      
                      const expandedPos = expandPositions(player.position);
                      const fitsStarting11 = expandedPos.some(pos => remainingPositionsCount[pos] > 0 && pos !== 'SUB');
                      const isGK = expandedPos.includes('GK');
                      const isSubOnly = !fitsStarting11 && benchRemaining > 0 && !isGK;
                      const isBlocked = !fitsStarting11 && !isSubOnly;

                      return (
                        <div
                          key={player.id}
                          onClick={() => !isBlocked && handleSelectPlayer(player)}
                          className={`bg-[#0a0a0a] border p-3 sm:p-4 rounded-xl flex justify-between items-center transition-all
                            ${isBlocked
                              ? 'opacity-30 cursor-not-allowed border-slate-800/50 grayscale pointer-events-none'
                              : isSubOnly
                              ? 'opacity-80 hover:opacity-100 hover:bg-[#111] border-slate-800 hover:border-yellow-500/50 cursor-pointer group'
                              : 'hover:bg-[#111] border-slate-800 hover:border-emerald-500 cursor-pointer group'
                            }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-base sm:text-lg flex-shrink-0 transition-colors
                              ${isBlocked ? 'bg-black text-slate-600 border border-slate-800' 
                              : isSubOnly ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                              : player.rating >= 85 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-black text-white border border-slate-800'}`}>
                              {player.rating}
                            </div>
                            <div className="truncate">
                              <p className={`font-bold text-base sm:text-lg transition-colors truncate 
                                ${isBlocked ? 'text-slate-500' : isSubOnly ? 'text-slate-300 group-hover:text-yellow-400' : 'text-white group-hover:text-emerald-400'}`}>
                                {player.player_name}
                              </p>
                              <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase truncate max-w-[120px] sm:max-w-xs">
                                {spinResult.teamName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isBlocked && (
                              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-600 tracking-wider border border-slate-800 px-1.5 py-0.5 rounded">
                                Filled
                              </span>
                            )}
                            {isSubOnly && (
                              <span className="text-[9px] sm:text-[10px] font-black uppercase text-yellow-500/80 tracking-wider border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                🔄 Sub
                              </span>
                            )}
                            <div className={`px-2 sm:px-3 py-1 rounded font-black text-[10px] sm:text-xs border whitespace-nowrap transition-colors
                              ${isSubOnly ? 'bg-black text-yellow-500/80 border-slate-800' : 'bg-black text-emerald-400 border-slate-800'}`}>
                              ({expandedPos.join(', ')})
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER 2: MANAGER SELECTION "PAGE" ---
  if (selectedFormation && !selectedManager) {
    return (
      <div className="min-h-screen bg-black text-slate-200 p-8 font-sans">
        <div className="max-w-5xl mx-auto">
          
          <button 
            onClick={() => setSelectedFormation(null)}
            className="mb-8 text-slate-500 hover:text-white font-bold flex items-center gap-2 transition-colors uppercase text-sm tracking-wider"
          >
            ← Back to Formations
          </button>

          <div className="mb-10">
            <h2 className="text-4xl font-black text-white mb-2">Select Manager</h2>
            <p className="text-slate-400 text-lg">Appoint a leader specializing in the <span className="text-emerald-400 font-bold">{selectedFormation}</span> setup.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupedManagers[selectedFormation]?.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedManager(m)}
                className="bg-[#050505] border border-slate-800/80 p-6 rounded-2xl hover:border-emerald-500 hover:bg-[#0a0a0a] transition-all text-left group flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 group-hover:bg-emerald-500 transition-colors"></div>
                <div className="pl-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 leading-tight mb-1">{m.manager_name}</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{m.teams?.club_name || "Free Agent"}</p>
                </div>
                <div className="pl-3 mt-6">
                  <span className="bg-[#111] px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 border border-slate-800 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                    Appoint Manager
                  </span>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // --- RENDER 3: MANAGER APPOINTED ---
  if (selectedManager && !isDrafting && !isSeasonMode) {
    return (
      <div className="min-h-screen bg-black text-slate-200 p-8 font-sans">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-extrabold text-center mb-2 text-white">
            Ultimate Football Draft 
          </h1>
          <p className="text-center text-slate-500 mb-12 text-lg">
            Select your league, choose your formation, and dictate your tactics.
          </p>

          <div className="max-w-2xl mx-auto bg-[#050505] border border-emerald-500/30 p-8 rounded-2xl text-center shadow-[0_0_40px_rgba(16,185,129,0.1)] mt-10">
            <h2 className="text-3xl font-bold text-white mb-1">{selectedManager.manager_name} Appointed!</h2>
            <h3 className="text-xl text-slate-400 mb-6 font-medium">Taking charge of <span className="text-white">{selectedManager.teams?.club_name}</span></h3>

            <div className="bg-[#0a0a0a] border border-slate-800 rounded-xl p-4 mb-8 inline-block">
              <p className="text-sm text-slate-400 uppercase tracking-widest font-bold mb-1">Tactical Setup</p>
              <p className="text-2xl text-emerald-400 font-black">{selectedManager.formation}</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button onClick={() => setSelectedManager(null)} className="px-6 py-3 rounded-lg font-bold bg-[#111] border border-slate-800 text-white hover:bg-slate-800 transition-colors">Change Manager</button>
              <button
                onClick={() => {
                  setIsDrafting(true);
                  setSpinResult({ teamId: null, teamName: "???", year: "2023" });
                  setDraftedRoster({});
                  setPendingPlayer(null);
                  setSpunTeams(new Set());
                }}
                className="px-8 py-3 rounded-lg font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/20"
              >
                Start Player Draft 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER 4: HOME / SETUP MODE ---
  return (
    <div className="min-h-screen bg-black text-slate-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-extrabold text-center mb-2 text-white">
          Ultimate Football Draft
        </h1>
        <p className="text-center text-slate-500 mb-12 text-lg">
          Select your league, choose your formation, and dictate your tactics.
        </p>

        {!selectedManager && !selectedFormation && (
          <>
            <div className="flex flex-wrap justify-center gap-3 mb-16 pb-8 border-b border-slate-800/50">
              {LEAGUES.map((league) => (
                <button
                  key={league.id}
                  onClick={() => setActiveLeague(league.id)}
                  className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${
                    activeLeague === league.id
                      ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      : "bg-[#0a0a0a] text-slate-400 hover:bg-[#111] hover:text-white border border-slate-800"
                  }`}
                >
                  {league.uiName}
                </button>
              ))}
            </div>

            {filteredManagers.length === 0 ? (
              <div className="text-center py-12 text-slate-600 italic font-bold">No managers found for this league.</div>
            ) : (
              <div>
                <h3 className="text-center text-slate-400 uppercase tracking-widest font-bold text-sm mb-8">Select Formation</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {sortedFormations.map(formation => {
                    const managerCount = groupedManagers[formation].length;
                    return (
                      <button
                        key={formation}
                        onClick={() => setSelectedFormation(formation)}
                        className="bg-[#050505] border border-slate-800 hover:border-emerald-500 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center group transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)] relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-3xl sm:text-4xl font-black text-white group-hover:text-emerald-400 transition-colors z-10">
                          {formation}
                        </span>
                        <span className="text-slate-500 text-[10px] sm:text-xs mt-3 uppercase tracking-widest font-bold z-10">
                          {managerCount} {managerCount === 1 ? 'Manager' : 'Managers'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}