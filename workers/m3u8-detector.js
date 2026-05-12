// ============================================================
// STRIMO — Cloudflare Worker: m3u8 Detector + Sports API Proxy
// Deploy at: https://dash.cloudflare.com → Workers
// ============================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Sports API endpoints (no CORS issues from worker)
const SPORTS_APIS = {
  // TheSportsDB - free tier
  sportsdb: 'https://www.thesportsdb.com/api/v1/json/3',
};

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Route to different handlers
  if (action === 'sports') {
    return handleSportsRequest(request);
  } else if (action === 'm3u8') {
    return handleM3u8Request(request);
  } else if (action === 'detect') {
    return handleDetectRequest(request);
  }

  // Default: m3u8 detector
  return handleM3u8Request(request);
}

// ── Sports Data Handler ───────────────────────────────────────
async function handleSportsRequest(request) {
  const url = new URL(request.url);
  const sport = url.searchParams.get('sport') || 'soccer';
  const type = url.searchParams.get('type') || 'today'; // today, live, upcoming

  try {
    const matches = await fetchSportsMatches(sport, type);
    return jsonResponse({
      success: true,
      sport,
      type,
      count: matches.length,
      matches
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message
    }, 500);
  }
}

// Fetch from multiple sports APIs
async function fetchSportsMatches(sport, type) {
  const allMatches = [];
  const seen = new Set();

  if (sport === 'soccer' || sport === 'all') {
    const soccerMatches = await fetchSoccerMatches();
    soccerMatches.forEach(m => {
      const key = `${m.homeTeam}-${m.awayTeam}-${m.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMatches.push({ ...m, sport: 'soccer' });
      }
    });
  }

  if (sport === 'cricket' || sport === 'all') {
    const cricketMatches = await fetchCricketMatches();
    cricketMatches.forEach(m => {
      const key = `${m.homeTeam}-${m.awayTeam}-${m.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMatches.push({ ...m, sport: 'cricket' });
      }
    });
  }

  // Sort by date
  allMatches.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return allMatches;
}

// Fetch soccer from multiple leagues
async function fetchSoccerMatches() {
  const matches = [];

  // League IDs to fetch
  const leagues = [
    { id: '4500', name: 'Premier League' },
    { id: '4480', name: 'La Liga' },
    { id: '4459', name: 'Serie A' },
    { id: '4538', name: 'Bundesliga' },
    { id: '4504', name: 'Ligue 1' },
    { id: '4544', name: 'Champions League' },
    { id: '4550', name: 'Europa League' },
    { id: '4512', name: 'MLS' },
  ];

  for (const league of leagues) {
    try {
      const res = await fetch(`${SPORTS_APIS.sportsdb}/eventsnextleague.php?id=${league.id}`);
      const data = await res.json();

      if (data.events) {
        for (const event of data.events) {
          matches.push({
            homeTeam: event.strHomeTeam,
            awayTeam: event.strAwayTeam,
            league: event.strLeague || league.name,
            startTime: event.strTimestamp || `${event.dateEvent}T${event.strTime}`,
            date: event.dateEvent,
            status: getStatus(event.strStatus),
            thumb: event.strThumb,
            leagueBadge: event.strLeagueBadge
          });
        }
      }
    } catch (e) {
      // Continue with other leagues
    }
  }

  // Also try eventsday for more coverage
  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const res = await fetch(`${SPORTS_APIS.sportsdb}/eventsday.php?d=${today}&s=soccer`);
    const data = await res.json();

    if (data.events) {
      for (const event of data.events) {
        matches.push({
          homeTeam: event.strHomeTeam,
          awayTeam: event.strAwayTeam,
          league: event.strLeague,
          startTime: event.strTimestamp || `${event.dateEvent}T${event.strTime}`,
          date: event.dateEvent,
          status: getStatus(event.strStatus),
          thumb: event.strThumb,
          leagueBadge: event.strLeagueBadge
        });
      }
    }
  } catch (e) {
    // Continue
  }

  return matches;
}

// Fetch cricket matches
async function fetchCricketMatches() {
  const matches = [];

  const cricketLeagues = [
    { id: '4574', name: 'IPL' },
    { id: '4576', name: 'Big Bash League' },
    { id: '4554', name: 'World Cup' },
  ];

  for (const league of cricketLeagues) {
    try {
      const res = await fetch(`${SPORTS_APIS.sportsdb}/eventsnextleague.php?id=${league.id}`);
      const data = await res.json();

      if (data.events) {
        for (const event of data.events) {
          matches.push({
            homeTeam: event.strHomeTeam,
            awayTeam: event.strAwayTeam,
            league: event.strLeague || league.name,
            startTime: event.strTimestamp || `${event.dateEvent}T${event.strTime}`,
            date: event.dateEvent,
            status: getStatus(event.strStatus),
            thumb: event.strThumb,
            leagueBadge: event.strLeagueBadge
          });
        }
      }
    } catch (e) {
      // Continue
    }
  }

  return matches;
}

function getStatus(status) {
  if (!status) return 'upcoming';
  const s = status.toLowerCase();
  if (s.includes('live') || s.includes('in progress')) return 'live';
  if (s.includes('finished') || s.includes('completed')) return 'completed';
  return 'upcoming';
}

// ── Stream Type Detection ─────────────────────────────────────
async function handleDetectRequest(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return jsonResponse({ error: 'Missing url parameter', type: 'unknown' }, 400);
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow'
    });

    const html = await res.text();

    // Detect stream types
    const results = {
      type: 'unknown',
      m3u8: [],
      iframes: [],
      embeds: []
    };

    // Find m3u8 links
    const m3u8Pattern = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g;
    results.m3u8 = html.match(m3u8Pattern) || [];

    // Find iframes
    const iframePattern = /<iframe[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = iframePattern.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('about:')) {
        results.iframes.push(match[1]);
      }
    }

    // Find embed codes
    const embedPattern = /(?:embed|player)[^>]*(?:src|source)=["']([^"']+)["']/gi;
    while ((match = embedPattern.exec(html)) !== null) {
      if (match[1] && match[1].includes('stream')) {
        results.embeds.push(match[1]);
      }
    }

    // Determine primary type
    if (results.m3u8.length > 0) {
      results.type = 'm3u8';
    } else if (results.iframes.length > 0) {
      results.type = 'iframe';
      results.embedUrl = results.iframes[0];
    } else if (results.embeds.length > 0) {
      results.type = 'embed';
      results.embedUrl = results.embeds[0];
    }

    return jsonResponse(results);

  } catch (err) {
    return jsonResponse({ type: 'error', error: err.message }, 200);
  }
}

// ── m3u8 Detector Handler ────────────────────────────────────
async function handleM3u8Request(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url') || url.searchParams.get('m3u8');

  if (!targetUrl) {
    return jsonResponse({ error: 'Missing ?url= parameter' }, 400);
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (e) {
    return jsonResponse({ error: 'Invalid URL provided' }, 400);
  }

  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (blocked.includes(parsedTarget.hostname)) {
    return jsonResponse({ error: 'Blocked URL' }, 403);
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow'
    });

    const html = await res.text();

    // Extract m3u8 URLs
    const patterns = [
      /https?:\/\/[^\s"'<>\]{}|\\^`]+\.m3u8(?:[^\s"'<>\]{}|\\^`]*)?/g,
      /"(?:src|url|source|file|stream|hls|hlsUrl|m3u8)":\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
      /(?:src|data-src|data-url)=["'](https?:\/\/[^"']+\.m3u8[^"']*)/g,
    ];

    const found = new Set();
    patterns.forEach(pattern => {
      const matches = html.match(pattern) || [];
      matches.forEach(u => found.add(cleanUrl(u)));
    });

    const chunkPattern = /https?:\/\/[^\s"'<>]+(?:chunklist|playlist|index)(?:_\w+)?\.m3u8/g;
    html.match(chunkPattern)?.forEach(u => found.add(u));

    const links = [...found].filter(u => u.startsWith('http')).slice(0, 20);
    return jsonResponse({ links, count: links.length, source: targetUrl });

  } catch (err) {
    return jsonResponse({
      error: `Failed to fetch: ${err.message}`,
      links: [],
      hint: 'The target site may block requests. Try finding the m3u8 URL manually.'
    }, 200);
  }
}

function cleanUrl(url) {
  return url.replace(/['")\]}>\\]+$/, '').trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    }
  });
}