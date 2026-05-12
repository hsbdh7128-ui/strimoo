// ============================================================
// STRIMO — Search Page Logic
// ============================================================

let allMatches   = [];
let searchQuery  = '';
let sportFilter  = 'all';

async function loadAllMatches() {
  try {
    const snap = await db.collection('matches')
      .orderBy('startTime', 'desc')
      .limit(200)
      .get();
    allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Pre-fetch stream counts
    await Promise.all(allMatches.map(async m => {
      const s = await db.collection('matches').doc(m.id).collection('streams')
        .where('isActive', '==', true).get();
      m.streamCount = s.size;
    }));

    // Pre-fill from URL param
    const q = getParam('q') || '';
    const sport = getParam('sport') || 'all';
    if (q) {
      searchQuery = q;
      const input = document.getElementById('searchInput');
      if (input) input.value = q;
    }
    if (sport !== 'all') {
      sportFilter = sport;
      document.querySelectorAll('#sportFilter .filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.sport === sport);
      });
    }

    renderResults();
  } catch (err) {
    console.error(err);
    const grid = document.getElementById('resultsGrid');
    if (grid) grid.innerHTML = '<div class="empty-state"><p>Failed to load matches.</p></div>';
  }
}

function renderResults() {
  const grid    = document.getElementById('resultsGrid');
  const infoEl  = document.getElementById('resultsInfo');
  if (!grid) return;

  const q = searchQuery.toLowerCase().trim();

  let filtered = [...allMatches];

  // Sport filter
  if (sportFilter !== 'all') {
    filtered = filtered.filter(m => m.sport === sportFilter);
  }

  // Text search
  if (q) {
    filtered = filtered.filter(m => {
      const fields = [m.homeTeam, m.awayTeam, m.league, m.tournament, m.sport]
        .map(f => (f || '').toLowerCase());
      return fields.some(f => f.includes(q));
    });
  }

  // Update info
  if (infoEl) {
    infoEl.textContent = q
      ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${searchQuery}"`
      : `Showing ${filtered.length} matches`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🔍</div>
        <h3>No Results Found</h3>
        <p>Try a different search term or sport filter.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(m => buildMatchCard(m)).join('');
}

// Search input — debounced
let debounceTimer;
document.getElementById('searchInput')?.addEventListener('input', e => {
  clearTimeout(debounceTimer);
  searchQuery = e.target.value;
  debounceTimer = setTimeout(renderResults, 280);
});

// Sport filter tabs
document.getElementById('sportFilter')?.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.getElementById('sportFilter').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    sportFilter = tab.dataset.sport;
    renderResults();
  });
});

document.addEventListener('DOMContentLoaded', loadAllMatches);
