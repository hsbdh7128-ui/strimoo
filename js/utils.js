// ============================================================
// STRIMO — Shared Utilities
// ============================================================

// ── Date / Time ─────────────────────────────────────────────
const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatMatchTime(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit',
    timeZone: userTZ
  }).format(date);
}

function formatMatchDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: userTZ
  }).format(date);
}

function formatFullDateTime(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: userTZ, timeZoneName: 'short'
  }).format(date);
}

function isToday(date) {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
}

function getDayLabel(date) {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return formatMatchDate(date);
}

// ── Countdown Timer ──────────────────────────────────────────
function startCountdown(targetDate, containerEl) {
  function update() {
    const now  = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      containerEl.innerHTML = '<span class="badge badge-live"><span class="live-dot"></span> LIVE</span>';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const s = Math.floor((diff % 60000)    / 1000);

    const parts = d > 0
      ? [['d', d], ['h', h], ['m', m]]
      : [['h', h], ['m', m], ['s', s]];

    containerEl.innerHTML = parts.map(([label, val], i) => `
      <span class="countdown-unit">
        <span class="countdown-value">${String(val).padStart(2,'0')}</span>
        <span class="countdown-label">${label}</span>
      </span>
      ${i < parts.length - 1 ? '<span class="countdown-sep">:</span>' : ''}
    `).join('');
  }
  update();
  return setInterval(update, 1000);
}

// ── Status Badge HTML ────────────────────────────────────────
function statusBadge(status) {
  if (status === 'live') return '<span class="badge badge-live"><span class="live-dot"></span> LIVE</span>';
  if (status === 'upcoming') return '<span class="badge badge-upcoming">⏰ Upcoming</span>';
  return '<span class="badge badge-completed">✓ Completed</span>';
}

// ── Sport Icon ───────────────────────────────────────────────
const SPORT_ICONS = { soccer: '⚽', cricket: '🏏', default: '🏆' };
function sportIcon(sport) { return SPORT_ICONS[sport] || SPORT_ICONS.default; }

// ── Team Initials (fallback icon) ────────────────────────────
function teamInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Match Card HTML Builder ──────────────────────────────────
function buildMatchCard(match) {
  const startDate = tsToDate(match.startTime);
  const isLive    = match.status === 'live';
  const url       = `match.html?id=${match.id}`;

  return `
    <a href="${url}" class="match-card ${isLive ? 'is-live' : ''}">
      <div class="match-card-header">
        <span class="match-league">${sportIcon(match.sport)} ${match.league || match.tournament || ''}</span>
        ${statusBadge(match.status)}
      </div>
      <div class="match-teams">
        <div class="match-team">
          <div class="team-icon">${teamInitials(match.homeTeam)}</div>
          <div class="team-name">${match.homeTeam || 'TBA'}</div>
        </div>
        <div class="match-vs">VS</div>
        <div class="match-team">
          <div class="team-icon">${teamInitials(match.awayTeam)}</div>
          <div class="team-name">${match.awayTeam || 'TBA'}</div>
        </div>
      </div>
      <div class="match-card-footer">
        <span class="match-time">🕐 ${startDate ? formatMatchTime(startDate) : '--'}</span>
        <span class="match-streams">▶ ${match.streamCount || 0} stream${match.streamCount !== 1 ? 's' : ''}</span>
      </div>
    </a>
  `;
}

// ── Skeleton Cards ───────────────────────────────────────────
function buildSkeletonCards(count = 6) {
  return Array(count).fill('').map(() => `
    <div class="match-card" style="pointer-events:none">
      <div class="match-card-header">
        <span class="skeleton" style="width:120px;height:14px"></span>
        <span class="skeleton" style="width:50px;height:18px;border-radius:20px"></span>
      </div>
      <div class="match-teams" style="padding:12px 0">
        <div class="match-team">
          <div class="team-icon skeleton" style="border:none"></div>
          <span class="skeleton" style="width:70px;height:12px"></span>
        </div>
        <div class="match-vs" style="opacity:0.2">VS</div>
        <div class="match-team">
          <div class="team-icon skeleton" style="border:none"></div>
          <span class="skeleton" style="width:70px;height:12px"></span>
        </div>
      </div>
      <div class="match-card-footer">
        <span class="skeleton" style="width:80px;height:12px"></span>
        <span class="skeleton" style="width:60px;height:12px"></span>
      </div>
    </div>
  `).join('');
}

// ── Toast Notifications ──────────────────────────────────────
let toastContainer = null;
function initToasts() {
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
}
function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) initToasts();
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── URL Params ───────────────────────────────────────────────
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ── Active Nav Link ──────────────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.includes(path)) a.classList.add('active');
  });
}

// ── Mobile Nav Toggle ────────────────────────────────────────
function initNav() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
  setActiveNav();
}

// ── Disclaimer Bar Close ─────────────────────────────────────
function initDisclaimer() {
  const closed = localStorage.getItem('strimo_disclaimer_closed');
  const bar    = document.getElementById('disclaimerBar');
  if (!bar) return;
  if (closed) bar.style.display = 'none';
  const btn = document.getElementById('disclaimerClose');
  if (btn) btn.addEventListener('click', () => {
    bar.style.display = 'none';
    localStorage.setItem('strimo_disclaimer_closed', '1');
  });
}

// ── Init on DOM Ready ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initDisclaimer();
});
