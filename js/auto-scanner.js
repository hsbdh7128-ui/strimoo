// ============================================================
// STRIMO — Auto Stream Scanner (m3u8 + iframes + embeds)
// Scans sites for all types of stream links
// ============================================================

const STREAM_SOURCES = [
  // Soccer sites
  'https://sportsbay.org/',
  'https://720pstream.tv/',
  'https://www.totalsportek.com/',
  'https://www.espn.com/watch/',
  'https://www.fcstreams.xyz/',
  'https://sportsurge.ws/',
  'https://stream2watch.ws/',
  'https://www.batmanstream.com/',
  'https://www.feed2all.eu/',
  // Cricket sites
  'https://www.cricbuzz.com/',
  'https://www.hotstar.com/',
  // Add more sites
];

const SCAN_WORKER_URL = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev';

class StreamScanner {
  constructor() {
    this.results = [];
    this.scanning = false;
  }

  async scanSite(url) {
    try {
      const workerUrl = `${SCAN_WORKER_URL}?action=m3u8&url=${encodeURIComponent(url)}`;
      const res = await fetch(workerUrl);

      if (!res.ok) return null;

      const data = await res.json();

      const streams = {
        source: url,
        m3u8: data.links || [],
        iframes: [],
        external: [],
        timestamp: new Date()
      };

      return streams;
    } catch (err) {
      console.error(`Error scanning ${url}:`, err);
      return null;
    }
  }

  async scanAllSources(onProgress) {
    if (this.scanning) return;
    this.scanning = true;
    this.results = [];

    for (let i = 0; i < STREAM_SOURCES.length; i++) {
      const url = STREAM_SOURCES[i];
      if (onProgress) onProgress(i + 1, STREAM_SOURCES.length, url);

      const result = await this.scanSite(url);
      if (result && (result.m3u8.length > 0 || result.iframes.length > 0)) {
        this.results.push(result);
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    this.scanning = false;
    return this.results;
  }

  getAllStreams() {
    return {
      m3u8: this.results.flatMap(r => r.m3u8),
      iframes: this.results.flatMap(r => r.iframes),
      external: this.results.flatMap(r => r.external)
    };
  }
}

// Parse various stream types from a URL
async function detectStreamType(url) {
  try {
    const workerUrl = `${SCAN_WORKER_URL}?action=detect&url=${encodeURIComponent(url)}`;
    const res = await fetch(workerUrl);
    const data = await res.json();

    return data;
  } catch (err) {
    return { type: 'unknown', error: err.message };
  }
}

// Export
window.StreamScanner = StreamScanner;
window.detectStreamType = detectStreamType;