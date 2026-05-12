// ============================================================
// STRIMO — Match Fetcher (uses Cloudflare Worker as proxy)
// Bypasses CORS by routing through worker
// ============================================================

// Your Cloudflare Worker URL
const WORKER_URL = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev';

// Fetch matches via worker (no CORS issues)
async function fetchMatchesViaWorker(sport = 'all', type = 'today') {
  const url = `${WORKER_URL}?action=sports&sport=${sport}&type=${type}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      return data.matches || [];
    } else {
      console.error('Worker error:', data.error);
      return [];
    }
  } catch (err) {
    console.error('Failed to fetch via worker:', err);
    return [];
  }
}

// Fetch soccer matches
async function fetchTodaySoccer() {
  const matches = await fetchMatchesViaWorker('soccer', 'today');

  return matches
    .filter(m => m.sport === 'soccer')
    .map(m => ({
      sport: 'soccer',
      homeTeam: m.homeTeam || 'Home',
      awayTeam: m.awayTeam || 'Away',
      league: m.league || 'Unknown League',
      startTime: m.startTime ? new Date(m.startTime) : new Date(),
      status: m.status || 'upcoming',
      thumb: m.thumb || null,
      leagueBadge: m.leagueBadge || null
    }));
}

// Fetch cricket matches
async function fetchTodayCricket() {
  const matches = await fetchMatchesViaWorker('cricket', 'today');

  return matches
    .filter(m => m.sport === 'cricket')
    .map(m => ({
      sport: 'cricket',
      homeTeam: m.homeTeam || 'Home',
      awayTeam: m.awayTeam || 'Away',
      league: m.league || 'Unknown League',
      startTime: m.startTime ? new Date(m.startTime) : new Date(),
      status: m.status || 'upcoming',
      thumb: m.thumb || null,
      leagueBadge: m.leagueBadge || null
    }));
}

// Fetch both
async function fetchTodayMatches() {
  const matches = await fetchMatchesViaWorker('all', 'today');

  const soccer = matches.filter(m => m.sport === 'soccer').map(m => ({
    sport: 'soccer',
    homeTeam: m.homeTeam || 'Home',
    awayTeam: m.awayTeam || 'Away',
    league: m.league || 'Unknown League',
    startTime: m.startTime ? new Date(m.startTime) : new Date(),
    status: m.status || 'upcoming',
    thumb: m.thumb || null,
    leagueBadge: m.leagueBadge || null
  }));

  const cricket = matches.filter(m => m.sport === 'cricket').map(m => ({
    sport: 'cricket',
    homeTeam: m.homeTeam || 'Home',
    awayTeam: m.awayTeam || 'Away',
    league: m.league || 'Unknown League',
    startTime: m.startTime ? new Date(m.startTime) : new Date(),
    status: m.status || 'upcoming',
    thumb: m.thumb || null,
    leagueBadge: m.leagueBadge || null
  }));

  return { soccer, cricket, all: [...soccer, ...cricket] };
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