// ============================================================
// STRIMO — Home Page Logic (simplified - shows all matches)
// ============================================================

const liveGrid     = document.getElementById('liveGrid');
const soccerGrid   = document.getElementById('soccerGrid');
const cricketGrid  = document.getElementById('cricketGrid');
const upcomingGrid = document.getElementById('upcomingGrid');

async function loadHome() {
  // Show skeletons
  if (liveGrid)     liveGrid.innerHTML    = buildSkeletonCards(3);
  if (soccerGrid)   soccerGrid.innerHTML  = buildSkeletonCards(4);
  if (cricketGrid)  cricketGrid.innerHTML = buildSkeletonCards(4);

  try {
    // Fetch all matches - simple query
    const snap = await db.collection('matches').get();

    const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('All matches loaded:', allMatches.length);

    if (allMatches.length === 0) {
      showEmptyStates();
      return;
    }

    // Fetch stream counts
    for (const m of allMatches) {
      try {
        const sSnap = await db.collection('matches').doc(m.id).collection('streams')
          .where('isActive', '==', true).get();
        m.streamCount = sSnap.size;
      } catch (e) {
        m.streamCount = 0;
      }
    }

    // Categorize matches (simple - no date filtering)
    const liveMatches     = allMatches.filter(m => m.status === 'live');
    const soccerMatches   = allMatches.filter(m => m.sport === 'soccer');
    const cricketMatches  = allMatches.filter(m => m.sport === 'cricket');
    const upcomingMatches = allMatches.filter(m => m.status === 'upcoming');

    console.log('Categories - Live:', liveMatches.length, 'Soccer:', soccerMatches.length, 'Cricket:', cricketMatches.length);

    // Update stats
    const statLiveEl    = document.getElementById('statLive');
    const statTodayEl   = document.getElementById('statToday');
    const statStreamsEl = document.getElementById('statStreams');
    if (statLiveEl)   statLiveEl.textContent   = liveMatches.length;
    if (statTodayEl)  statTodayEl.textContent  = soccerMatches.length + cricketMatches.length;
    if (statStreamsEl) statStreamsEl.textContent = allMatches.reduce((a, m) => a + (m.streamCount || 0), 0);

    // Sport counts
    const soccerCountEl  = document.getElementById('soccerCount');
    const cricketCountEl = document.getElementById('cricketCount');
    if (soccerCountEl)  soccerCountEl.textContent  = `${soccerMatches.length} match${soccerMatches.length !== 1 ? 'es' : ''}`;
    if (cricketCountEl) cricketCountEl.textContent = `${cricketMatches.length} match${cricketMatches.length !== 1 ? 'es' : ''}`;

    // Render live
    if (liveGrid) {
      liveGrid.innerHTML = liveMatches.length
        ? liveMatches.map(m => buildMatchCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">📡</div><h3>No Live Matches</h3><p>Check the schedule for upcoming games.</p></div>';
    }

    // Render soccer (show all soccer matches, not just today)
    if (soccerGrid) {
      const toShow = soccerMatches.slice(0, 8);
      soccerGrid.innerHTML = toShow.length
        ? toShow.map(m => buildMatchCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">⚽</div><h3>No Soccer Matches</h3><p>Add matches in the admin panel.</p></div>';
    }

    // Render cricket (show all cricket matches)
    if (cricketGrid) {
      const toShow = cricketMatches.slice(0, 8);
      cricketGrid.innerHTML = toShow.length
        ? toShow.map(m => buildMatchCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">🏏</div><h3>No Cricket Matches</h3><p>Add matches in the admin panel.</p></div>';
    }

    // Render upcoming
    if (upcomingGrid) {
      if (upcomingMatches.length) {
        upcomingGrid.innerHTML = upcomingMatches.slice(0, 6).map(m => {
          const startDate = tsToDate(m.startTime);
          return `
            <div class="match-card" onclick="location.href='match.html?id=${m.id}'">
              <div class="match-card-header">
                <span class="match-league">${sportIcon(m.sport)} ${m.league || m.tournament || ''}</span>
                ${statusBadge(m.status)}
              </div>
              <div class="match-teams">
                <div class="match-team">
                  <div class="team-icon">${teamInitials(m.homeTeam)}</div>
                  <div class="team-name">${m.homeTeam}</div>
                </div>
                <div class="match-vs">VS</div>
                <div class="match-team">
                  <div class="team-icon">${teamInitials(m.awayTeam)}</div>
                  <div class="team-name">${m.awayTeam}</div>
                </div>
              </div>
              <div class="match-card-footer" style="flex-direction:column;align-items:center;gap:8px">
                <div id="countdown-${m.id}" class="countdown"></div>
                <span class="match-time" style="font-size:0.72rem">${startDate ? formatFullDateTime(startDate) : 'TBA'}</span>
              </div>
            </div>
          `;
        }).join('');

        upcomingMatches.slice(0, 6).forEach(m => {
          const el = document.getElementById(`countdown-${m.id}`);
          if (el && m.startTime) startCountdown(tsToDate(m.startTime), el);
        });
      } else {
        upcomingGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Upcoming Matches</h3><p>Add matches in admin panel.</p></div>';
      }
    }

  } catch (err) {
    console.error('Error loading home data:', err);
    showEmptyStates();
  }
}

function showEmptyStates() {
  if (liveGrid) liveGrid.innerHTML = '<div class="empty-state"><p>Could not load matches.</p></div>';
  if (soccerGrid) soccerGrid.innerHTML = '<div class="empty-state"><p>No matches available.</p></div>';
  if (cricketGrid) cricketGrid.innerHTML = '<div class="empty-state"><p>No matches available.</p></div>';
}

document.addEventListener('DOMContentLoaded', loadHome);