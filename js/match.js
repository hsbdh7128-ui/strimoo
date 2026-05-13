// ============================================================
// STRIMO — Match / Stream Page with HLS.js Player
// ============================================================

let currentMatch   = null;
let allStreams      = [];
let activeStreamUrl = null;
let hlsInstance    = null;
let vjsPlayer      = null;

const matchId = getParam('id');

// ── Load Match Data ──────────────────────────────────────────
async function loadMatch() {
  if (!matchId) { showError('No match ID specified.'); return; }

  try {
    // Load match
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) { showError('Match not found.'); return; }
    currentMatch = { id: matchDoc.id, ...matchDoc.data() };

    renderMatchHeader();
    document.title = `${currentMatch.homeTeam} vs ${currentMatch.awayTeam} — Strimo`;

    // Load streams (simple query without order to avoid index issues)
    const streamsSnap = await db.collection('matches').doc(matchId)
      .collection('streams')
      .get();

    allStreams = streamsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.isActive !== false); // Filter out inactive streams

    console.log('Match status:', currentMatch.status, 'Streams:', allStreams.length);
    renderStreamSelector();
    loadRelatedMatches();

    // Auto-load first stream if live and streams exist
    console.log('Checking auto-play:', currentMatch.status, allStreams.length);
    if (currentMatch.status === 'live' && allStreams.length > 0) {
      console.log('Auto-playing first stream...');
      setTimeout(() => {
        loadStream(allStreams[0]);
        // Also auto-click the button to show it's active
        const firstBtn = document.getElementById(`streamBtn-${allStreams[0].id}`);
        if (firstBtn) firstBtn.click();
      }, 500);
    }

  } catch (err) {
    console.error(err);
    showError('Failed to load match data. Please refresh.');
  }
}

// ── Render Match Header ──────────────────────────────────────
function renderMatchHeader() {
  const m = currentMatch;
  const sportPath = m.sport === 'soccer' ? 'soccer.html' : 'cricket.html';

  // Breadcrumb
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <a href="index.html">Home</a> <span>/</span>
      <a href="${sportPath}">${m.sport === 'soccer' ? '⚽ Soccer' : '🏏 Cricket'}</a> <span>/</span>
      <span>${m.homeTeam} vs ${m.awayTeam}</span>
    `;
  }

  // Teams
  const teamsEl = document.getElementById('matchTeams');
  if (teamsEl) {
    teamsEl.innerHTML = `
      <div class="match-page-team">
        <div class="match-page-team-icon">${teamInitials(m.homeTeam)}</div>
        <div class="match-page-team-name">${m.homeTeam}</div>
      </div>
      <div style="text-align:center">
        <div class="match-page-vs">VS</div>
        ${statusBadge(m.status)}
      </div>
      <div class="match-page-team">
        <div class="match-page-team-icon">${teamInitials(m.awayTeam)}</div>
        <div class="match-page-team-name">${m.awayTeam}</div>
      </div>
    `;
  }

  // Meta
  const metaEl = document.getElementById('matchMeta');
  const startDate = tsToDate(m.startTime);
  if (metaEl) {
    metaEl.innerHTML = `
      <span>${sportIcon(m.sport)} ${m.league || m.tournament || ''}</span>
      <span>📅 ${startDate ? formatFullDateTime(startDate) : 'TBA'}</span>
    `;
  }

  // Update stream status
  setStreamStatus('ready', `${allStreams.length} stream${allStreams.length !== 1 ? 's' : ''} available`);
}

// ── Render Stream Buttons ────────────────────────────────────
function renderStreamSelector() {
  const selector = document.getElementById('streamSelector');
  const list     = document.getElementById('streamList');
  if (!selector || !list) return;

  if (!allStreams.length) {
    setStreamStatus('loading', 'No streams available for this match yet.');
    return;
  }

  selector.style.display = 'block';
  list.innerHTML = allStreams.map((s, i) => `
    <button class="stream-btn ${i === 0 && currentMatch.status === 'live' ? 'active' : ''}"
      id="streamBtn-${s.id}"
      onclick="loadStream(allStreams[${i}])"
      data-type="${s.type}"
      data-url="${encodeURIComponent(s.url)}">
      ${s.type === 'm3u8' ? '📡' : s.type === 'iframe' ? '🖥' : '↗'}
      ${s.label || `Stream ${i + 1}`}
      <span class="stream-quality-tag">${s.quality === 'hd' ? 'HD' : s.quality === 'sd' ? 'SD' : '~'}</span>
    </button>
  `).join('');

  // Add external link buttons separately
  const externalStreams = allStreams.filter(s => s.type === 'external');
  if (externalStreams.length) {
    list.innerHTML += externalStreams.map(s => `
      <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="stream-btn external">
        ↗ ${s.label} <span class="stream-quality-tag">EXT</span>
      </a>
    `).join('');
  }
}

// ── Load and Play a Stream ───────────────────────────────────
function loadStream(stream) {
  if (!stream) return;
  activeStreamUrl = stream.url;

  // Mark active button
  document.querySelectorAll('.stream-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`streamBtn-${stream.id}`);
  if (btn) btn.classList.add('active');

  if (stream.type === 'external') {
    window.open(stream.url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (stream.type === 'm3u8') {
    playM3u8(stream.url);
  } else if (stream.type === 'iframe') {
    playIframe(stream.url);
  }
}

// ── HLS.js m3u8 Playback ─────────────────────────────────────
const CORS_PROXY = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev?action=proxy&url=';

function playM3u8(url) {
  const placeholder = document.getElementById('playerPlaceholder');
  const videoEl     = document.getElementById('strimoPlayer');
  const corsNotice  = document.getElementById('corsNotice');
  const corsOpenBtn = document.getElementById('corsOpenBtn');

  // Route through CORS proxy to bypass browser restrictions
  const proxiedUrl = CORS_PROXY + encodeURIComponent(url);

  if (placeholder) placeholder.style.display = 'none';
  if (corsNotice)  corsNotice.classList.remove('visible');
  if (videoEl)     videoEl.style.display = 'block';

  setStreamStatus('loading', 'Connecting to stream...');

  // Destroy previous instances
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  if (vjsPlayer)   { try { vjsPlayer.dispose(); } catch(e){} vjsPlayer = null; }

  // Re-create video element (Video.js disposes it)
  const wrap = document.getElementById('playerWrap');
  wrap.querySelectorAll('video').forEach(v => v.remove());
  const newVideo = document.createElement('video');
  newVideo.id = 'strimoPlayer';
  newVideo.className = 'video-js vjs-default-skin';
  newVideo.controls = true;
  newVideo.style.cssText = 'width:100%;height:100%;display:block';
  wrap.appendChild(newVideo);

  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      xhrSetup: function(xhr) {
        xhr.withCredentials = false;
      }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.warn('HLS fatal error:', data);
        handleStreamError(url);
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStreamStatus('ready', 'Stream connected — playing');
      newVideo.play().catch(() => {});
    });

    hls.loadSource(proxiedUrl);
    hls.attachMedia(newVideo);
    hlsInstance = hls;

    vjsPlayer = videojs(newVideo, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      techOrder: ['html5']
    });

  } else if (newVideo.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    newVideo.src = proxiedUrl;
    newVideo.play().catch(() => {});
    setStreamStatus('ready', 'Stream connected (via CORS proxy)');
  } else {
    handleStreamError(url);
  }
}

// ── Iframe Embed Playback ────────────────────────────────────
function playIframe(url) {
  const wrap = document.getElementById('playerWrap');
  const placeholder = document.getElementById('playerPlaceholder');
  const videoEl = document.getElementById('strimoPlayer');

  if (!wrap) return;

  // Hide other elements
  if (placeholder) placeholder.style.display = 'none';
  if (videoEl) videoEl.style.display = 'none';

  // Destroy HLS if running
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  // Clear and add iframe
  wrap.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.frameBorder = '0';
  iframe.allowFullscreen = true;
  iframe.allow = 'autoplay; fullscreen; encrypted-media';
  iframe.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;border:none';
  iframe.scrolling = 'no';

  // Handle iframe load errors
  iframe.onload = function() {
    setStreamStatus('ready', 'Embedded stream loaded');
  };

  iframe.onerror = function() {
    setStreamStatus('error', 'Stream may be blocked. Try opening in new tab.');
    // Fallback: offer to open externally
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#fff;text-align:center;padding:20px">
        <p style="margin-bottom:15px">This stream cannot be embedded directly.</p>
        <a href="${url}" target="_blank" style="background:#e94560;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Open in New Tab</a>
      </div>
    `;
  };

  wrap.appendChild(iframe);
  setStreamStatus('loading', 'Loading embedded stream...');
}

// ── CORS / Error Fallback ────────────────────────────────────
function handleStreamError(url) {
  setStreamStatus('cors-error', '⚠️ Stream blocked by browser security (CORS). Open in new tab instead.');
  const corsNotice  = document.getElementById('corsNotice');
  const corsOpenBtn = document.getElementById('corsOpenBtn');
  if (corsNotice)  corsNotice.classList.add('visible');
  if (corsOpenBtn) corsOpenBtn.href = url;

  const placeholder = document.getElementById('playerPlaceholder');
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
      <div class="player-placeholder-icon">⚠️</div>
      <p style="color:var(--accent-gold)">Stream blocked. Use "Open in New Tab" below.</p>
    `;
  }
}

// ── Stream Status Helper ─────────────────────────────────────
function setStreamStatus(type, message) {
  const el = document.getElementById('streamStatus');
  if (!el) return;
  const icons = { loading: '⏳', ready: '✅', 'cors-error': '⚠️' };
  el.className = `stream-status ${type}`;
  el.innerHTML = `<span>${icons[type] || ''} ${message}</span>`;
}

// ── Related Matches ──────────────────────────────────────────
async function loadRelatedMatches() {
  if (!currentMatch) return;
  const container = document.getElementById('relatedMatches');
  try {
    const snap = await db.collection('matches')
      .where('sport', '==', currentMatch.sport)
      .where('status', 'in', ['live', 'upcoming'])
      .limit(6)
      .get();

    const related = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.id !== matchId);

    if (!related.length) {
      if (container) container.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted)">No related matches.</p>';
      return;
    }
    if (container) {
      container.innerHTML = related.map(m => `
        <a href="match.html?id=${m.id}" class="sidebar-match-item">
          <span>${sportIcon(m.sport)}</span>
          <div>
            <div class="sidebar-match-teams">${m.homeTeam} vs ${m.awayTeam}</div>
            <div class="sidebar-match-time">${m.league || m.tournament || ''}</div>
          </div>
          ${statusBadge(m.status)}
        </a>
      `).join('');
    }
  } catch (err) {
    if (container) container.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted)">Could not load related matches.</p>';
  }
}

// ── Report Button ────────────────────────────────────────────
document.getElementById('reportBtn')?.addEventListener('click', () => {
  showToast('Thanks for reporting! We\'ll review this stream.', 'success');
});

// ── Error State ──────────────────────────────────────────────
function showError(msg) {
  const teamsEl = document.getElementById('matchTeams');
  if (teamsEl) teamsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error</h3><p>${msg}</p></div>`;
}

document.addEventListener('DOMContentLoaded', loadMatch);
