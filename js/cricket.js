// ============================================================
// STRIMO — Cricket Page Logic
// ============================================================

let allMatches = [];
let currentStatus = 'all';
let currentLeague = 'all';

async function loadCricket() {
  const grid = document.getElementById('matchesGrid');
  if (grid) grid.innerHTML = buildSkeletonCards(8);

  const filterParam = getParam('filter');
  if (filterParam) {
    currentStatus = filterParam;
    document.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.status === filterParam);
    });
  }

  try {
    const snap = await db.collection('matches')
      .where('sport', '==', 'cricket')
      .orderBy('startTime', 'desc')
      .limit(100)
      .get();

    allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    await Promise.all(allMatches.map(async m => {
      const s = await db.collection('matches').doc(m.id).collection('streams')
        .where('isActive', '==', true).get();
      m.streamCount = s.size;
    }));

    renderMatches();
    renderLiveSidebar();

  } catch (err) {
    console.error(err);
    if (grid) grid.innerHTML = '<div class="empty-state"><p>Failed to load matches. Please refresh.</p></div>';
  }
}

function renderMatches() {
  const grid = document.getElementById('matchesGrid');
  if (!grid) return;
  let filtered = [...allMatches];
  if (currentStatus !== 'all') filtered = filtered.filter(m => m.status === currentStatus);
  if (currentLeague !== 'all') filtered = filtered.filter(m => (m.league || m.tournament || '') === currentLeague);
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏏</div><h3>No Matches Found</h3><p>Try changing your filters.</p></div>';
    return;
  }
  grid.innerHTML = filtered.map(m => buildMatchCard(m)).join('');
}

function renderLiveSidebar() {
  const sidebar = document.getElementById('liveListSidebar');
  if (!sidebar) return;
  const live = allMatches.filter(m => m.status === 'live');
  if (!live.length) {
    sidebar.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted)">No live matches right now.</p>';
    return;
  }
  sidebar.innerHTML = live.map(m => `
    <a href="match.html?id=${m.id}" class="sidebar-match-item">
      <span>🏏</span>
      <div>
        <div class="sidebar-match-teams">${m.homeTeam} vs ${m.awayTeam}</div>
        <div class="sidebar-match-time">${m.league || m.tournament || ''}</div>
      </div>
      <span class="badge badge-live" style="font-size:0.6rem"><span class="live-dot"></span>LIVE</span>
    </a>
  `).join('');
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentStatus = tab.dataset.status;
    renderMatches();
  });
});

document.querySelectorAll('.league-badge').forEach(badge => {
  badge.addEventListener('click', () => {
    document.querySelectorAll('.league-badge').forEach(b => b.classList.remove('active'));
    badge.classList.add('active');
    currentLeague = badge.dataset.league;
    renderMatches();
  });
});

document.addEventListener('DOMContentLoaded', loadCricket);
