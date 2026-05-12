// ============================================================
// STRIMO — Match Scheduler (Auto-fetch matches)
// Uses multiple APIs for better coverage
// ============================================================

const SPORTS_API_URL = 'https://www.thesportsdb.com/api/v1/json/3';

// Popular soccer league IDs
const SOCCER_LEAGUES = [
  { id: '4500', name: 'Premier League' },
  { id: '4480', name: 'La Liga' },
  { id: '4459', name: 'Serie A' },
  { id: '4538', name: 'Bundesliga' },
  { id: '4504', name: 'Ligue 1' },
  { id: '4544', name: 'Champions League' },
  { id: '4550', name: 'Europa League' },
  { id: '4512', name: 'MLS' },
  { id: '4740', name: 'EFL Championship' },
  { id: '4531', name: 'FA Cup' },
  { id: '4556', name: 'Carabao Cup' },
];

// Cricket league IDs
const CRICKET_LEAGUES = [
  { id: '4574', name: 'IPL' },
  { id: '4576', name: 'Big Bash League' },
  { id: '4554', name: 'World Cup' },
  { id: '4562', name: 'T20 World Cup' },
];

// Helper: format date as YYYYMMDD
function getDateStr(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Fetch matches by league (next 15 days)
async function fetchMatchesByLeague(leagueId) {
  try {
    const url = `${SPORTS_API_URL}/eventsnextleague.php?id=${leagueId}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`Failed to fetch league ${leagueId}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return data.events || [];
  } catch (err) {
    console.warn(`Error fetching league ${leagueId}:`, err);
    return [];
  }
}

// Fetch from eventsday endpoint
async function fetchByDate(dateStr) {
  try {
    const url = `${SPORTS_API_URL}/eventsday.php?d=${dateStr}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.events || [];
  } catch (err) {
    console.warn(`Error fetching by date ${dateStr}:`, err);
    return [];
  }
}

// Fetch soccer matches from multiple sources
async function fetchTodaySoccer() {
  const seenMatches = new Set();
  const allMatches = [];

  console.log('Fetching soccer matches...');

  // Method 1: Fetch from top leagues
  const leaguePromises = SOCCER_LEAGUES.map(async (league) => {
    const events = await fetchMatchesByLeague(league.id);
    console.log(`League ${league.name}: ${events.length} events`);
    return events;
  });

  const leagueResults = await Promise.all(leaguePromises);

  for (const events of leagueResults) {
    for (const event of events) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapToMatch(event, 'soccer'));
      }
    }
  }

  // Method 2: Try eventsday for today's popular leagues
  const today = getDateStr();
  const leaguesToTry = ['English Premier League', 'La Liga', 'Serie A', 'Bundesliga'];

  for (const leagueName of leaguesToTry) {
    const events = await fetchByDate(today);
    const filtered = events.filter(e =>
      e.strLeague && e.strLeague.toLowerCase().includes(leagueName.toLowerCase().split(' ')[0])
    );

    for (const event of filtered) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapToMatch(event, 'soccer'));
      }
    }
  }

  // Sort by time
  allMatches.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));

  console.log(`Total soccer matches found: ${allMatches.length}`);
  return allMatches;
}

// Fetch cricket matches
async function fetchTodayCricket() {
  const seenMatches = new Set();
  const allMatches = [];

  console.log('Fetching cricket matches...');

  // Fetch from cricket leagues
  const leaguePromises = CRICKET_LEAGUES.map(async (league) => {
    const events = await fetchMatchesByLeague(league.id);
    console.log(`Cricket League ${league.name}: ${events.length} events`);
    return events;
  });

  const leagueResults = await Promise.all(leaguePromises);

  for (const events of leagueResults) {
    for (const event of events) {
      const key = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
      if (!seenMatches.has(key)) {
        seenMatches.add(key);
        allMatches.push(mapToMatch(event, 'cricket'));
      }
    }
  }

  console.log(`Total cricket matches found: ${allMatches.length}`);
  return allMatches;
}

// Map API event to our format
function mapToMatch(event, sport) {
  const status = getMatchStatus(event.strStatus);

  return {
    sport,
    homeTeam: event.strHomeTeam || 'Home',
    awayTeam: event.strAwayTeam || 'Away',
    league: event.strLeague || 'Unknown',
    startTime: event.strTimestamp ? new Date(event.strTimestamp) : new Date(event.dateEvent + ' ' + (event.strTime || '00:00')),
    status,
    thumb: event.strThumb || null,
    leagueBadge: event.strLeagueBadge || null
  };
}

// Determine status
function getMatchStatus(statusStr) {
  if (!statusStr) return 'upcoming';
  const s = statusStr.toLowerCase();
  if (s.includes('live') || s.includes('in progress') || s.includes('half time')) return 'live';
  if (s.includes('finished') || s.includes('completed')) return 'completed';
  return 'upcoming';
}

// Main fetch function
async function fetchTodayMatches() {
  const [soccer, cricket] = await Promise.all([
    fetchTodaySoccer(),
    fetchTodayCricket()
  ]);

  return { soccer, cricket, all: [...soccer, ...cricket] };
}

// Export
window.fetchTodaySoccer = fetchTodaySoccer;
window.fetchTodayCricket = fetchTodayCricket;
window.fetchTodayMatches = fetchTodayMatches;