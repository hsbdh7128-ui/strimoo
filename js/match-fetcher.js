// ============================================================
// STRIMO — Match Scheduler (Auto-fetch today's matches)
// Uses TheSportsDB free API
// ============================================================

const SPORTS_API_URL = 'https://www.thesportsdb.com/api/v1/json/3';

async function fetchTodayMatches(sport = 'soccer') {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

  let apiUrl = '';
  if (sport === 'soccer') {
    apiUrl = `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&s=soccer`;
  } else if (sport === 'cricket') {
    apiUrl = `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&s=cricket`;
  }

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.events) return [];

    return data.events.map(event => ({
      sport,
      homeTeam: event.strHomeTeam || 'Home',
      awayTeam: event.strAwayTeam || 'Away',
      league: event.strLeague || 'Unknown League',
      startTime: event.strTimestamp ? new Date(event.strTimestamp) : new Date(event.dateEvent + ' ' + (event.strTime || '00:00')),
      status: getMatchStatus(event.strStatus),
      thumb: event.strThumb || null,
      leagueBadge: event.strLeagueBadge || null
    }));
  } catch (err) {
    console.error('Error fetching matches:', err);
    return [];
  }
}

function getMatchStatus(status) {
  if (!status) return 'upcoming';
  const s = status.toLowerCase();
  if (s.includes('live') || s.includes('in progress')) return 'live';
  if (s.includes('finished') || s.includes('completed')) return 'completed';
  return 'upcoming';
}

// For cricket - fetch from a different endpoint if needed
async function fetchCricketMatches() {
  return fetchTodayMatches('cricket');
}

// Export for use
window.fetchTodayMatches = fetchTodayMatches;
window.fetchCricketMatches = fetchCricketMatches;