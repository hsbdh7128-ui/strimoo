// ============================================================
// STRIMO — Auto Stream Scanner
// Scans known streaming sites for free m3u8 links
// ============================================================

// Known streaming sites to scan (add more as needed)
const STREAM_SOURCES = [
  'https://sportsbay.org/',
  'https://720pstream.tv/',
  'https://www.totalsportek.com/',
  'https://www.espn.com/watch/',
  'https://www.fcstreams.xyz/',
  // Add more sites here
];

const SCAN_WORKER_URL = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev';

class StreamScanner {
  constructor() {
    this.results = [];
    this.scanning = false;
  }

  async scanSite(url) {
    try {
      const workerUrl = `${SCAN_WORKER_URL}?url=${encodeURIComponent(url)}`;
      const res = await fetch(workerUrl);

      if (!res.ok) return null;

      const data = await res.json();
      return {
        source: url,
        links: data.links || [],
        count: data.links?.length || 0,
        timestamp: new Date()
      };
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
      if (result && result.links.length > 0) {
        this.results.push(result);
      }

      // Rate limiting - wait between scans
      await new Promise(r => setTimeout(r, 1000));
    }

    this.scanning = false;
    return this.results;
  }

  getM3u8Links() {
    return this.results.flatMap(r => r.links);
  }
}

// Site-specific scanners (for sites that need special handling)
const customScanners = {
  // Add custom scanning logic for specific sites if needed
};

// Auto-match finder - tries to find stream for a specific match
async function findStreamForMatch(homeTeam, awayTeam) {
  const scanner = new StreamScanner();
  const allLinks = await scanner.scanAllSources();

  // Simple matching - look for team names in link titles
  const searchTerm = `${homeTeam} ${awayTeam}`.toLowerCase();

  return allLinks.filter(link =>
    link.toLowerCase().includes(homeTeam.toLowerCase()) ||
    link.toLowerCase().includes(awayTeam.toLowerCase())
  );
}

// Export
window.StreamScanner = StreamScanner;
window.findStreamForMatch = findStreamForMatch;