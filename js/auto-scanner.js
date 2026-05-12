// ============================================================
// STRIMO — Auto Stream Scanner (safe)
// ============================================================

(function() {
  const STREAM_SOURCES = [
    'https://sportsbay.org/',
    'https://720pstream.tv/',
    'https://sportsurge.ws/',
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
        return { source: url, m3u8: data.links || [], timestamp: new Date() };
      } catch (err) {
        return null;
      }
    }

    async scanAllSources(onProgress) {
      if (this.scanning) return;
      this.scanning = true;
      this.results = [];

      for (let i = 0; i < STREAM_SOURCES.length; i++) {
        if (onProgress) onProgress(i + 1, STREAM_SOURCES.length, STREAM_SOURCES[i]);
        const result = await this.scanSite(STREAM_SOURCES[i]);
        if (result && result.m3u8.length > 0) this.results.push(result);
        await new Promise(r => setTimeout(r, 500));
      }

      this.scanning = false;
      return this.results;
    }

    getAllStreams() {
      return this.results.flatMap(r => r.m3u8);
    }
  }

  window.StreamScanner = StreamScanner;
  console.log('Auto scanner loaded');
})();