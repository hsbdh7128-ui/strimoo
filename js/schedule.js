// ============================================================
// STRIMO — Schedule Page Logic
// ============================================================

let allMatches = [];
let sportFilter   = 'all';
let statusFilter  = 'all';

const tzEl = document.getElementById('tzDisplay');
if (tzEl) tzEl.textContent = userTZ;

async function loadSchedule() {
  const list = document.getElementById('scheduleList');
  if (list) list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const snap = await db.collection('matches')
      .orderBy('startTime', 'asc')
      .limit(150)
      .get();

    allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSchedule();

  } catch (err) {
    console.error(err);
    const list = document.getElementById('scheduleList');
    if (list) list.innerHTML = '<div class="empty-state"><p>Failed to load schedule. Please refresh.</p></div>';
  }
}

function renderSchedule() {
  const list = document.getElementById('scheduleList');
  if (!list) return;

  // Apply filters
  let filtered = [...allMatches];
  if (sportFilter !== 'all')  filtered = filtered.filter(m => m.sport === sportFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(m => m.status === statusFilter);

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Matches Found</h3><p>Try changing your filters.</p></div>';
    return;
  }

  // Group by day
  const groups = {};
  filtered.forEach(m => {
    const date = tsToDate(m.startTime);
    if (!date) return;
    const key = date.toDateString();
    if (!groups[key]) groups[key] = { date, matches: [] };
    groups[key].matches.push(m);
  });

  list.innerHTML = Object.values(groups).map(group => `
    <div class="schedule-day">
      <div class="schedule-day-header">
        <div class="schedule-day-date">${formatMatchDate(group.date)}</div>
        <div class="schedule-day-label">${getDayLabel(group.date)}</div>
        <div style="flex:1;height:1px;background:var(--border);margin-left:var(--space-sm)"></div>
      </div>
      <div class="schedule-list">
        ${group.matches.map(m => `
          <a href="match.html?id=${m.id}" class="schedule-item">
            <div class="schedule-time">${formatMatchTime(tsToDate(m.startTime))}</div>
            <div class="schedule-sport-icon">${sportIcon(m.sport)}</div>
            <div class="schedule-match-info">
              <div class="schedule-teams">${m.homeTeam} <span style="color:var(--text-muted);font-weight:400">vs</span> ${m.awayTeam}</div>
              <div class="schedule-league">${m.league || m.tournament || '—'}</div>
            </div>
            ${statusBadge(m.status)}
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Sport Filter
document.getElementById('sportFilter')?.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.getElementById('sportFilter').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    sportFilter = tab.dataset.sport;
    renderSchedule();
  });
});

// Status Filter
document.getElementById('statusFilter')?.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.getElementById('statusFilter').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    statusFilter = tab.dataset.status;
    renderSchedule();
  });
});

document.addEventListener('DOMContentLoaded', loadSchedule);
