// ============================================================
// STRIMO — Enhanced m3u8 Finder for Football
// Scans multiple sites to find direct m3u8 streams
// ============================================================

(function() {
  const WORKER_URL = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev';

  // Football streaming sites to scan
  const FOOTBALL_SITES = [
    // Popular streaming sites
    'https://sportsbay.org/',
    'https://720pstream.tv/',
    'https://www.totalsportek.com/',
    'https://www.espn.com/watch/',
    'https://www.fcstreams.xyz/',
    // Add more as needed
  ];

  // Search for m3u8 links on a specific site
  window.findM3u8Links = async function(siteUrl) {
    try {
      const workerUrl = `${WORKER_URL}?action=m3u8&url=${encodeURIComponent(siteUrl)}`;
      const res = await fetch(workerUrl);
      const data = await res.json();
      return data.links || [];
    } catch (err) {
      console.error('Error scanning site:', err);
      return [];
    }
  };

  // Scan multiple sites for football streams
  window.scanFootballSites = async function(onProgress) {
    const allLinks = [];

    for (let i = 0; i < FOOTBALL_SITES.length; i++) {
      if (onProgress) onProgress(i + 1, FOOTBALL_SITES.length, FOOTBALL_SITES[i]);

      const links = await window.findM3u8Links(FOOTBALL_SITES[i]);
      allLinks.push(...links.map(l => ({ url: l, source: FOOTBALL_SITES[i] })));

      await new Promise(r => setTimeout(r, 500));
    }

    return allLinks;
  };

  // Add a simple m3u8 finder interface in admin
  window.showM3u8Finder = function() {
    const modal = document.createElement('div');
    modal.id = 'm3u8FinderModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    modal.innerHTML = `
      <div style="background:#1a1a2e;border-radius:12px;padding:30px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto">
        <h2 style="color:#fff;margin-bottom:20px">🔍 Find m3u8 Links</h2>
        <p style="color:#888;margin-bottom:20px">Enter a streaming page URL to scan for m3u8 links</p>

        <div style="display:flex;gap:10px;margin-bottom:20px">
          <input type="url" id="m3u8ScanUrl" placeholder="https://sportsbay.org/football/..."
            style="flex:1;padding:12px;border-radius:8px;border:1px solid #333;background:#0f0f1a;color:#fff">
          <button onclick="runM3u8Scan()" style="padding:12px 20px;background:#e94560;border:none;border-radius:8px;color:#fff;cursor:pointer">Scan</button>
        </div>

        <div id="m3u8Results" style="display:none">
          <h4 style="color:#fff;margin-bottom:10px">Found Links:</h4>
          <div id="m3u8LinksList"></div>
        </div>

        <button onclick="document.getElementById('m3u8FinderModal').remove()" style="margin-top:20px;padding:10px;background:#333;border:none;border-radius:8px;color:#fff;cursor:pointer">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
  };

  window.runM3u8Scan = async function() {
    const url = document.getElementById('m3u8ScanUrl').value;
    if (!url) return;

    const resultsDiv = document.getElementById('m3u8Results');
    const listDiv = document.getElementById('m3u8LinksList');

    resultsDiv.style.display = 'block';
    listDiv.innerHTML = '<p style="color:#888">Scanning...</p>';

    const links = await window.findM3u8Links(url);

    if (links.length === 0) {
      listDiv.innerHTML = '<p style="color:#ff6b6b">No m3u8 links found. Try a different URL or add as external link.</p>';
    } else {
      listDiv.innerHTML = links.map(link => `
        <div style="background:#0f0f1a;padding:10px;margin:5px 0;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:#aaa;font-size:12px;word-break:break-all;max-width:300px">${link.substring(0, 60)}...</span>
          <button onclick="copyToStreamForm('${encodeURIComponent(link)}')" style="background:#e94560;border:none;padding:8px 12px;border-radius:4px;color:#fff;cursor:pointer;font-size:12px">Use This</button>
        </div>
      `).join('');
    }
  };

  window.copyToStreamForm = function(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    document.getElementById('sUrl').value = url;
    document.getElementById('sType').value = 'm3u8';
    document.getElementById('sLabel').value = 'HD Stream';
    document.getElementById('sQuality').value = 'hd';

    // Close modal
    document.getElementById('m3u8FinderModal')?.remove();

    // Scroll to form
    document.getElementById('sUrl')?.scrollIntoView({ behavior: 'smooth' });

    // Show toast
    if (window.showToast) window.showToast('m3u8 URL added to stream form!', 'success');
  };

  console.log('m3u8 Finder loaded');
})();