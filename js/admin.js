// ============================================================
// STRIMO — Admin Panel Logic
// ============================================================

// Cloudflare Worker URL for m3u8 detection
// Update this after deploying the worker
const WORKER_URL = 'https://strimo-m3u8-detector.hsbdh7128.workers.dev';

let currentUser = null;
let editingMatchId = null;
let pendingStreams = [];   // streams queued before saving match
let allAdminMatches = [];

// ── Auth ─────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    const emailEl = document.getElementById('adminEmail');
    const avatarEl = document.getElementById('adminAvatar');
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = user.email[0].toUpperCase();
    loadDashboard();
    loadMatchTable();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  }
});

// Login
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!email || !password) { showLoginError('Please enter email and password.'); return; }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    showLoginError(err.message);
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
});

document.getElementById('loginPassword')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
});

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => auth.signOut());

// ── Page Navigation ──────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.admin-page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.style.display = 'block';

  const navBtn = document.querySelector(`[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'matches') loadMatchTable();
  if (page === 'add-match') resetForm();
  if (page === 'auto-fetch') { /* No special load needed */ }
}

document.querySelectorAll('.admin-nav-item').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const snap = await db.collection('matches').get();
    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allAdminMatches = matches;

    document.getElementById('statTotal').textContent = matches.length;
    document.getElementById('statLive').textContent = matches.filter(m => m.status === 'live').length;
    document.getElementById('statUpcoming').textContent = matches.filter(m => m.status === 'upcoming').length;

    let totalStreams = 0;
    const recentList = document.getElementById('recentMatchesList');

    const recent = matches.sort((a, b) => (tsToDate(b.createdAt) || 0) - (tsToDate(a.createdAt) || 0)).slice(0, 8);
    if (recentList) {
      recentList.innerHTML = recent.map(m => `
        <div style="display:flex;align-items:center;gap:var(--space-md);padding:10px 0;border-bottom:1px solid var(--border)">
          <span>${sportIcon(m.sport)}</span>
          <span style="flex:1;font-size:0.88rem">${m.homeTeam} vs ${m.awayTeam}</span>
          <span style="font-size:0.78rem;color:var(--text-muted)">${m.league || ''}</span>
          ${statusBadge(m.status)}
          <button class="btn btn-ghost btn-sm" onclick="editMatch('${m.id}')">Edit</button>
        </div>
      `).join('') || '<p style="color:var(--text-muted);font-size:0.88rem">No matches yet. Add your first match!</p>';
    }

    // Count streams
    const streamsSnaps = await Promise.all(matches.slice(0, 20).map(m =>
      db.collection('matches').doc(m.id).collection('streams').get()
    ));
    totalStreams = streamsSnaps.reduce((a, s) => a + s.size, 0);
    document.getElementById('statTotalStreams').textContent = totalStreams;

  } catch (err) { console.error(err); }
}

// ── Match Table ──────────────────────────────────────────────
let matchListFilter = 'all';

async function loadMatchTable() {
  const tbody = document.getElementById('matchTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    const snap = await db.collection('matches').orderBy('startTime', 'desc').limit(100).get();
    allAdminMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMatchTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--accent-live)">Error loading matches: ${err.message}</td></tr>`;
  }
}

function renderMatchTable() {
  const tbody = document.getElementById('matchTableBody');
  if (!tbody) return;
  let list = [...allAdminMatches];
  if (matchListFilter !== 'all') list = list.filter(m => m.status === matchListFilter);
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No matches found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(m => {
    const d = tsToDate(m.startTime);
    return `
      <tr>
        <td><strong style="font-size:0.88rem">${m.homeTeam || '?'} vs ${m.awayTeam || '?'}</strong></td>
        <td>${sportIcon(m.sport)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${m.league || m.tournament || '—'}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${d ? formatMatchDate(d) + ' ' + formatMatchTime(d) : '—'}</td>
        <td>${statusBadge(m.status)}</td>
        <td>
          <select style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);padding:3px 6px;font-size:0.78rem;color:var(--text-primary);cursor:pointer"
            onchange="updateMatchStatus('${m.id}', this.value)">
            <option ${m.status === 'upcoming' ? 'selected' : ''} value="upcoming">Upcoming</option>
            <option ${m.status === 'live' ? 'selected' : ''} value="live">🔴 Live</option>
            <option ${m.status === 'completed' ? 'selected' : ''} value="completed">Completed</option>
          </select>
        </td>
        <td>
          <div class="admin-table-actions">
            <button class="btn btn-ghost btn-sm" onclick="openStreamModal('${m.id}','${m.homeTeam} vs ${m.awayTeam}')">📡 Streams</button>
            <button class="btn btn-ghost btn-sm" onclick="editMatch('${m.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m.id}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterMatchList(status, btn) {
  matchListFilter = status;
  document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMatchTable();
}

async function updateMatchStatus(matchId, newStatus) {
  try {
    await db.collection('matches').doc(matchId).update({ status: newStatus, updatedAt: nowTimestamp() });
    allAdminMatches = allAdminMatches.map(m => m.id === matchId ? { ...m, status: newStatus } : m);
    showToast(`Status updated to ${newStatus}`, 'success');
  } catch (err) { showToast('Failed to update: ' + err.message, 'error'); }
}

async function deleteMatch(matchId) {
  if (!confirm('Delete this match and all its streams? This cannot be undone.')) return;
  try {
    // Delete sub-collection streams
    const streams = await db.collection('matches').doc(matchId).collection('streams').get();
    await Promise.all(streams.docs.map(d => d.ref.delete()));
    await db.collection('matches').doc(matchId).delete();
    allAdminMatches = allAdminMatches.filter(m => m.id !== matchId);
    renderMatchTable();
    showToast('Match deleted.', 'success');
  } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
}

// ── Add / Edit Match Form ─────────────────────────────────────
function resetForm() {
  editingMatchId = null;
  pendingStreams = [];
  document.getElementById('matchFormTitle').textContent = 'Add Match';
  ['fSport', 'fStatus', 'fHomeTeam', 'fAwayTeam', 'fLeague', 'fStartTime', 'fFeatured'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fSport').value = 'soccer';
  document.getElementById('fStatus').value = 'upcoming';
  document.getElementById('fFeatured').value = 'false';
  document.getElementById('streamListPreview').innerHTML = '';
  document.getElementById('detectorResults').classList.remove('visible');
}

async function editMatch(matchId) {
  showPage('add-match');
  editingMatchId = matchId;
  document.getElementById('matchFormTitle').textContent = 'Edit Match';
  pendingStreams = [];

  try {
    const doc = await db.collection('matches').doc(matchId).get();
    const m = { id: doc.id, ...doc.data() };
    document.getElementById('fSport').value = m.sport || 'soccer';
    document.getElementById('fStatus').value = m.status || 'upcoming';
    document.getElementById('fHomeTeam').value = m.homeTeam || '';
    document.getElementById('fAwayTeam').value = m.awayTeam || '';
    document.getElementById('fLeague').value = m.league || m.tournament || '';
    document.getElementById('fFeatured').value = String(m.featured || false);
    if (m.startTime) {
      const d = tsToDate(m.startTime);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      document.getElementById('fStartTime').value = local.toISOString().slice(0, 16);
    }

    // Load existing streams
    const streamsSnap = await db.collection('matches').doc(matchId).collection('streams')
      .orderBy('order', 'asc').get();
    pendingStreams = streamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStreamPreview();

  } catch (err) { showToast('Error loading match: ' + err.message, 'error'); }
}

async function saveMatch() {
  const sport = document.getElementById('fSport').value;
  const status = document.getElementById('fStatus').value;
  const homeTeam = document.getElementById('fHomeTeam').value.trim();
  const awayTeam = document.getElementById('fAwayTeam').value.trim();
  const league = document.getElementById('fLeague').value.trim();
  const startTime = document.getElementById('fStartTime').value;
  const featured = document.getElementById('fFeatured').value === 'true';

  if (!homeTeam || !awayTeam) { showToast('Home and Away team names are required.', 'error'); return; }

  const matchData = {
    sport, status, homeTeam, awayTeam,
    league: league || null,
    tournament: league || null,
    startTime: startTime ? firebase.firestore.Timestamp.fromDate(new Date(startTime)) : null,
    featured,
    updatedAt: nowTimestamp()
  };

  const saveBtn = document.getElementById('saveMatchBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    let matchId = editingMatchId;

    if (matchId) {
      await db.collection('matches').doc(matchId).update(matchData);
    } else {
      matchData.createdAt = nowTimestamp();
      const ref = await db.collection('matches').add(matchData);
      matchId = ref.id;
    }

    // Save pending streams
    for (let i = 0; i < pendingStreams.length; i++) {
      const s = pendingStreams[i];
      const streamData = { label: s.label, type: s.type, url: s.url, quality: s.quality, isActive: true, order: i };
      if (s.id && s.id.startsWith('existing-')) {
        // Already saved, update order
        await db.collection('matches').doc(matchId).collection('streams').doc(s.docId).update({ order: i });
      } else if (!s.id) {
        await db.collection('matches').doc(matchId).collection('streams').add(streamData);
      }
    }

    showToast(editingMatchId ? 'Match updated!' : 'Match added!', 'success');
    setTimeout(() => showPage('matches'), 800);
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }

  saveBtn.disabled = false;
  saveBtn.textContent = '💾 Save Match';
}

// ── Stream List Builder ──────────────────────────────────────
function addStreamToList() {
  const label = document.getElementById('sLabel').value.trim() || `Stream ${pendingStreams.length + 1}`;
  const type = document.getElementById('sType').value;
  const url = document.getElementById('sUrl').value.trim();
  const quality = document.getElementById('sQuality').value;

  if (!url) { showToast('Please enter a stream URL.', 'error'); return; }

  pendingStreams.push({ label, type, url, quality });
  renderStreamPreview();

  document.getElementById('sLabel').value = '';
  document.getElementById('sUrl').value = '';
}

function removeStream(index) {
  pendingStreams.splice(index, 1);
  renderStreamPreview();
}

function renderStreamPreview() {
  const el = document.getElementById('streamListPreview');
  if (!el) return;
  if (!pendingStreams.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="stream-manager-title" style="margin-bottom:8px">Stream Queue (${pendingStreams.length})</div>
    ${pendingStreams.map((s, i) => `
      <div class="stream-item">
        <span class="stream-item-label">${s.label}</span>
        <span class="stream-item-url">${s.url}</span>
        <span class="stream-item-type ${s.type}">${s.type.toUpperCase()}</span>
        <span class="badge badge-hd" style="font-size:0.6rem">${s.quality.toUpperCase()}</span>
        <button class="btn btn-danger btn-sm" onclick="removeStream(${i})">✕</button>
      </div>
    `).join('')}
  `;
}

// ── Stream Detector (m3u8 + iframes + external) ─────────────────
async function detectStream() {
  const urlInput = document.getElementById('detectorUrl');
  const btn = document.getElementById('detectBtn');
  const resultsEl = document.getElementById('detectorResults');
  const linksEl = document.getElementById('detectorLinksList');
  const targetUrl = urlInput?.value.trim();

  if (!targetUrl) { showToast('Please enter a URL.', 'error'); return; }
  if (!targetUrl.startsWith('http')) { showToast('Please enter a valid URL starting with http.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Detecting...';
  if (resultsEl) resultsEl.classList.remove('visible');

  try {
    // Use the detect endpoint to find stream type
    const workerUrl = `${WORKER_URL}?action=detect&url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(workerUrl);

    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    const data = await res.json();

    if (resultsEl) resultsEl.classList.add('visible');

    // Add the stream based on detected type
    if (data.m3u8 && data.m3u8.length > 0) {
      // Found direct m3u8 - add as m3u8 type
      addStreamDirect(data.m3u8[0], 'm3u8', 'HD');
      if (linksEl) linksEl.innerHTML = `<p style="color:var(--accent-success)">✅ Added m3u8 stream!</p>`;
      showToast('Added m3u8 stream!', 'success');
    } else if (data.iframes && data.iframes.length > 0) {
      // Found iframe - add as iframe type
      addStreamDirect(data.iframes[0], 'iframe', 'HD');
      if (linksEl) linksEl.innerHTML = `<p style="color:var(--accent-success)">✅ Added iframe embed!</p>`;
      showToast('Added iframe stream!', 'success');
    } else {
      // No direct streams found - add as external link
      addStreamDirect(targetUrl, 'external', 'HD');
      if (linksEl) linksEl.innerHTML = `<p style="color:var(--accent-blue)">✅ Added as external link (opens in new tab)</p>`;
      showToast('Added as external link!', 'success');
    }

    // Clear the input
    if (urlInput) urlInput.value = '';

  } catch (err) {
    // If detection fails, add as external link anyway
    addStreamDirect(targetUrl, 'external', 'HD');
    if (resultsEl) resultsEl.classList.add('visible');
    if (linksEl) linksEl.innerHTML = `<p style="color:var(--accent-blue)">✅ Added as external link</p>`;
    showToast('Added as external link', 'success');
  }

  btn.disabled = false;
  btn.textContent = '➕ Add Stream';
}

// Add stream directly to pending list
function addStreamDirect(url, type, quality) {
  const label = `Stream ${pendingStreams.length + 1}`;
  pendingStreams.push({ label, type, url, quality });
  renderStreamPreview();
}

function useDetectedLink(encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  const sUrlEl = document.getElementById('sUrl');
  const sTypeEl = document.getElementById('sType');
  const sLabelEl = document.getElementById('sLabel');
  if (sUrlEl) sUrlEl.value = url;
  if (sTypeEl) sTypeEl.value = 'm3u8';
  if (sLabelEl && !sLabelEl.value) sLabelEl.value = `Stream ${pendingStreams.length + 1}`;
  showToast('m3u8 URL pasted into stream form!', 'success');
  document.getElementById('sUrl')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Stream Modal (per-match stream management) ────────────────
async function openStreamModal(matchId, matchName) {
  const modal = document.getElementById('streamModal');
  const content = document.getElementById('modalContent');
  const title = document.getElementById('modalTitle');
  if (!modal || !content) return;

  if (title) title.textContent = `Streams: ${matchName}`;
  modal.style.display = 'flex';
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const snap = await db.collection('matches').doc(matchId).collection('streams')
      .orderBy('order', 'asc').get();
    const streams = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!streams.length) {
      content.innerHTML = `
        <p style="color:var(--text-muted);margin-bottom:var(--space-md)">No streams yet.</p>
        <button class="btn btn-primary" onclick="editMatch('${matchId}')">Add Streams →</button>`;
      return;
    }

    content.innerHTML = streams.map(s => `
      <div class="stream-item" style="margin-bottom:8px">
        <span class="stream-item-label">${s.label}</span>
        <span class="stream-item-url">${s.url}</span>
        <span class="stream-item-type ${s.type}">${s.type.toUpperCase()}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteStream('${matchId}','${s.id}',this)">🗑</button>
      </div>
    `).join('');

  } catch (err) {
    content.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
  }
}

async function deleteStream(matchId, streamId, btn) {
  if (!confirm('Delete this stream?')) return;
  try {
    await db.collection('matches').doc(matchId).collection('streams').doc(streamId).delete();
    if (btn) btn.closest('.stream-item').remove();
    showToast('Stream deleted.', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function closeModal() {
  const modal = document.getElementById('streamModal');
  if (modal) modal.style.display = 'none';
}

// Close modal on backdrop click
document.getElementById('streamModal')?.addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ── Toast (admin override) ───────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}
