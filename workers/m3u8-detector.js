// ============================================================
// STRIMO — Cloudflare Worker: m3u8 Link Detector
// Deploy this at: https://dash.cloudflare.com → Workers
// ============================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

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

  const url       = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return jsonResponse({ error: 'Missing ?url= parameter' }, 400);
  }

  // Basic URL validation
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (e) {
    return jsonResponse({ error: 'Invalid URL provided' }, 400);
  }

  // Block private/local IPs
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (blocked.includes(parsedTarget.hostname)) {
    return jsonResponse({ error: 'Blocked URL' }, 403);
  }

  try {
    // Fetch the target page
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Referer': parsedTarget.origin,
      },
      redirect: 'follow',
      cf: { cacheTtl: 30, cacheEverything: false }
    });

    const html = await res.text();

    // Extract m3u8 URLs using multiple patterns
    const patterns = [
      // Direct .m3u8 URLs
      /https?:\/\/[^\s"'<>\]{}|\\^`]+\.m3u8(?:[^\s"'<>\]{}|\\^`]*)?/g,
      // URLs in JSON/JS objects
      /"(?:src|url|source|file|stream|hls|hlsUrl|streamUrl|m3u8|playback_url|playlist_url)":\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
      // URLs in HTML attributes
      /(?:src|data-src|data-url|data-file|data-stream)=["'](https?:\/\/[^"']+\.m3u8[^"']*)/g,
    ];

    const found = new Set();

    // Pattern 1: direct URLs
    const direct = html.match(patterns[0]) || [];
    direct.forEach(u => found.add(cleanUrl(u)));

    // Pattern 2: JSON key-value
    let m;
    const re2 = patterns[1];
    while ((m = re2.exec(html)) !== null) {
      if (m[1]) found.add(cleanUrl(m[1]));
    }

    // Pattern 3: HTML attributes
    const re3 = patterns[2];
    while ((m = re3.exec(html)) !== null) {
      if (m[1]) found.add(cleanUrl(m[1]));
    }

    // Also look for chunklist or stream references
    const chunkPattern = /https?:\/\/[^\s"'<>]+(?:chunklist|playlist|index)(?:_\w+)?\.m3u8(?:\?[^\s"'<>]*)?/g;
    const chunks = html.match(chunkPattern) || [];
    chunks.forEach(u => found.add(cleanUrl(u)));

    const links = [...found].filter(u => u.startsWith('http')).slice(0, 20);

    return jsonResponse({ links, count: links.length, source: targetUrl });

  } catch (err) {
    return jsonResponse({
      error: `Failed to fetch URL: ${err.message}`,
      links: [],
      hint: 'The target site may block external requests. Try finding the m3u8 URL manually via browser DevTools → Network tab → filter by .m3u8'
    }, 200);
  }
}

function cleanUrl(url) {
  // Remove trailing quote/bracket characters
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
