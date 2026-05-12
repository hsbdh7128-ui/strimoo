// ============================================================
// STRIMO — Match Scheduler (Auto-fetch today's matches)
// Uses TheSportsDB free API for both Soccer and Cricket
// ============================================================

const SPORTS_API_URL = 'https://www.thesportsdb.com/api/v1/json/3';

// Fetch today's soccer matches
async function fetchTodaySoccer() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

  const apiUrl = `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&s=soccer`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.events) return [];

    return data.events.map(event => ({
      sport: 'soccer',
      homeTeam: event.strHomeTeam || 'Home',
      awayTeam: event.strAwayTeam || 'Away',
      league: event.strLeague || 'Unknown League',
      startTime: event.strTimestamp ? new Date(event.strTimestamp) : new Date(event.dateEvent + ' ' + (event.strTime || '00:00')),
      status: getMatchStatus(event.strStatus),
      thumb: event.strThumb || null,
      leagueBadge: event.strLeagueBadge || null
    }));
  } catch (err) {
    console.error('Error fetching soccer matches:', err);
    return [];
  }
}

// Fetch today's cricket matches
// Note: TheSportsDB has limited cricket data, using multiple endpoints
async function fetchTodayCricket() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

  // Try different endpoints for cricket
  const endpoints = [
    `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&s=cricket`,
    `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&l=Indian%20Premier%20League`,
    `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&l=ICC%20World%20Cup`,
    `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&l=Big%20Bash%20League`,
    `${SPORTS_API_URL}/eventsday.php?d=${dateStr}&l=T20%20World%20Cup`
  ];

  const allCricketMatches = [];
  const seenMatches = new Set();

  for (const apiUrl of endpoints) {
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (data.events) {
        for (const event of data.events) {
          // Avoid duplicates
          const matchKey = `${event.strHomeTeam}-${event.strAwayTeam}-${event.dateEvent}`;
          if (!seenMatches.has(matchKey)) {
            seenMatches.add(matchKey);
            allCricketMatches.push({
              sport: 'cricket',
              homeTeam: event.strHomeTeam || 'Home',
              awayTeam: event.strAwayTeam || 'Away',
              league: event.strLeague || 'Unknown League',
              startTime: event.strTimestamp ? new Date(event.strTimestamp) : new Date(event.dateEvent + ' ' + (event.strTime || '00:00')),
              status: getMatchStatus(event.strStatus),
              thumb: event.strThumb || null,
              leagueBadge: event.strLeagueBadge || null
            });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching cricket from endpoint:', apiUrl, err);
    }
  }

  return allCricketMatches;
}

// Fetch both soccer and cricket matches
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

// Legacy function - defaults to soccer for backward compatibility
async function fetchTodayMatchesLegacy(sport = 'soccer') {
  if (sport === 'cricket') {
    return fetchTodayCricket();
  }
  return fetchTodaySoccer();
}

function getMatchStatus(status) {
  if (!status) return 'upcoming';
  const s = status.toLowerCase();
  if (s.includes('live') || s.includes('in progress')) return 'live';
  if (s.includes('finished') || s.includes('completed')) return 'completed';
  return 'upcoming';
}

// Export for use
window.fetchTodaySoccer = fetchTodaySoccer;
window.fetchTodayCricket = fetchTodayCricket;
window.fetchTodayMatches = fetchTodayMatches;
window.fetchTodayMatchesLegacy = fetchTodayMatchesLegacy;