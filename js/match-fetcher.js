// ============================================================
// STRIMO — Match Fetcher (safe, won't break page)
// ============================================================

(function() {
  const WORKER_URL = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev';

  // Fetch matches via worker - with error handling
  async function fetchMatchesViaWorker(sport = 'all', type = 'today') {
    try {
      const url = `${WORKER_URL}?action=sports&sport=${sport}&type=${type}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        return data.matches || [];
      }
      console.warn('Worker returned error:', data.error);
      return [];
    } catch (err) {
      console.warn('Failed to fetch matches:', err.message);
      return [];
    }
  }

  // Fetch soccer matches
  window.fetchTodaySoccer = async function() {
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
  };

  // Fetch cricket matches
  window.fetchTodayCricket = async function() {
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
  };

  // Fetch both
  window.fetchTodayMatches = async function() {
    try {
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
    } catch (e) {
      return { soccer: [], cricket: [], all: [] };
    }
  };

  console.log('Match fetcher loaded');
})();