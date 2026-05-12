// ============================================================
// STRIMO — Match Scheduler (Auto-fetch matches)
// Uses TheSportsDB free API - fetches from multiple leagues/dates
// ============================================================

const SPORTS_API_URL = 'https://www.thesportsdb.com/api/v1/json/3';

// League IDs for popular soccer competitions
const SOCCER_LEAGUES = [
  { id: '4500', name: 'Premier League' },
  { id: '4480', name: 'La Liga' },
  { id: '4459', name: 'Serie A' },
  { id: '4538', name: 'Bundesliga' },
  { id: '4504', name: 'Ligue 1' },
  { id: '4544', name: 'Champions League' },
  { id: '4550', name: 'Europa League' },
  { id: '4570', name: 'World Cup' },
  { id: '4560', name: 'Euro' },
  { id: '4531', name: 'FA Cup' },
  { id: '4556', name: 'Carabao Cup' },
  { id: '4512', name: 'MLS' },
  { id: '4578', name: 'Copa America' },
  { id: '4740', name: 'EFL Championship' },
  { id: '4743', name: 'League One' },
];

// Cricket leagues
const CRICKET_LEAGUES = [
  { id: '4574', name: 'Indian Premier League' },
  { id: '4576', name: 'Big Bash League' },
  { id: '4554', name: 'World Cup' },
  { id: '4562', name: 'T20 World Cup' },
  { id: '4577', name: 'Caribbean Premier League' },
  { id: '4579', name: 'Pakistan Super League' },
  { id: '4580', name: 'Sri Lanka Premier League' },
  { id: '4581', name: 'Bangladesh Premier League' },
];

// Helper: get date string in format YYYYMMDD
function getDateStr(date = new Date()) {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

// Get dates to search (yesterday, today, tomorrow, etc.)
function getSearchDates(daysBack = 1, daysForward = 3) {
  const dates = [];
  const today = new Date();

  for (let i = -daysBack; i <= daysForward; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(getDateStr(d));
  }

  return dates;
}

// Fetch matches by date
async function fetchMatchesByDate(dateStr, sport = 'soccer') {
  const apiUrl = `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&s=${sport}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    return data.events || [];
  } catch (err) {
    console.error(`Error fetching ${sport} matches for ${dateStr}:`, err);
    return [];
  }
}

// Fetch matches by league ID (next 15 days)
async function fetchMatchesByLeague(leagueId, sport = 'soccer') {
  const apiUrl = `${SPORTS_API_URL}/eventsnextleague.php?id=${leagueId}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    return data.events || [];
  } catch (err) {
    console.error(`Error fetching league ${leagueId}:`, err);
    return [];
  }
}

// Fetch today's soccer matches from multiple sources
async function fetchTodaySoccer() {
  const seenMatches = new Set();
  const allMatches = [];

  // Method 1: Get matches by date (today, yesterday, tomorrow)
  const dates = getSearchDates(1, 2);

  for (const dateStr of dates) {
    const events = await fetchMatchesByDate(dateStr, 'soccer');

    for (const event of events) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapEventToMatch(event, 'soccer'));
      }
    }
  }

  // Method 2: Get matches from popular leagues
  const leaguePromises = SOCCER_LEAGUES.slice(0, 8).map(league =>
    fetchMatchesByLeague(league.id, 'soccer')
  );

  const leagueResults = await Promise.all(leaguePromises);

  for (const events of leagueResults) {
    for (const event of events) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapEventToMatch(event, 'soccer'));
      }
    }
  }

  // Sort by date
  allMatches.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));

  return allMatches;
}

// Fetch today's cricket matches
async function fetchTodayCricket() {
  const seenMatches = new Set();
  const allMatches = [];

  // Method 1: Get matches by date
  const dates = getSearchDates(1, 2);

  for (const dateStr of dates) {
    const events = await fetchMatchesByDate(dateStr, 'cricket');

    for (const event of events) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapEventToMatch(event, 'cricket'));
      }
    }
  }

  // Method 2: Get matches from cricket leagues
  const leaguePromises = CRICKET_LEAGUES.map(league =>
    fetchMatchesByLeague(league.id, 'cricket')
  );

  const leagueResults = await Promise.all(leaguePromises);

  for (const events of leagueResults) {
    for (const event of events) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapEventToMatch(event, 'cricket'));
      }
    }
  }

  allMatches.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));

  return allMatches;
}

// Map API event to our match format
function mapEventToMatch(event, sport) {
  return {
    sport,
    homeTeam: event.strHomeTeam || 'Home',
    awayTeam: event.strAwayTeam || 'Away',
    league: event.strLeague || 'Unknown League',
    startTime: event.strTimestamp ? new Date(event.strTimestamp) : new Date(event.dateEvent + ' ' + (event.strTime || '00:00')),
    status: getMatchStatus(event.strStatus, event.intHomeScore, event.intAwayScore),
    thumb: event.strThumb || null,
    leagueBadge: event.strLeagueBadge || null
  };
}

// Determine match status
function getMatchStatus(status, homeScore, awayScore) {
  if (!status) return 'upcoming';
  const s = status.toLowerCase();

  if (s.includes('live') || s.includes('in progress') || s.includes('half time')) {
    return 'live';
  }
  if (s.includes('finished') || s.includes('completed') || s.includes('final')) {
    return 'completed';
  }
  if (s.includes('postponed') || s.includes('suspended') || s.includes('cancelled')) {
    return 'postponed';
  }

  // If scores exist, it's likely live or finished
  if (homeScore !== null && awayScore !== null) {
    return 'live';
  }

  return 'upcoming';
}

// Fetch both soccer and cricket
async function fetchTodayMatches() {
  const [soccer, cricket] = await Promise.all([
    fetchTodaySoccer(),
    fetchTodayCricket()
  ]);

  return {
    soccer,
    cricket,
    all: [...soccer, ...cricket]
  };
}

// Legacy compatibility
async function fetchTodayMatchesLegacy(sport = 'soccer') {
  if (sport === 'cricket') return fetchTodayCricket();
  return fetchTodaySoccer();
}

// Export
window.fetchTodaySoccer = fetchTodaySoccer;
window.fetchTodayCricket = fetchTodayCricket;
window.fetchTodayMatches = fetchTodayMatches;
window.fetchTodayMatchesLegacy = fetchTodayMatchesLegacy;