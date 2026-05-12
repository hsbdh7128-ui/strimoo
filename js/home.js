// ============================================================
// STRIMO — Home Page Logic
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
    const now        = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const endOfDay   = new Date(now); endOfDay.setHours(23,59,59,999);

    // Fetch all matches for today + upcoming
    const snap = await db.collection('matches')
      .orderBy('startTime', 'asc')
      .limit(60)
      .get();

    const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch stream counts for each match
    await Promise.all(allMatches.map(async m => {
      const sSnap = await db.collection('matches').doc(m.id).collection('streams')
        .where('isActive', '==', true).get();
      m.streamCount = sSnap.size;
    }));

    const liveMatches     = allMatches.filter(m => m.status === 'live');
    const soccerToday     = allMatches.filter(m => m.sport === 'soccer' && isToday(tsToDate(m.startTime)));
    const cricketToday    = allMatches.filter(m => m.sport === 'cricket' && isToday(tsToDate(m.startTime)));
    const upcoming        = allMatches.filter(m => m.status === 'upcoming').slice(0, 6);

    // Stats
    const statLiveEl    = document.getElementById('statLive');
    const statTodayEl   = document.getElementById('statToday');
    const statStreamsEl  = document.getElementById('statStreams');
    if (statLiveEl)   statLiveEl.textContent   = liveMatches.length;
    if (statTodayEl)  statTodayEl.textContent  = soccerToday.length + cricketToday.length;
    if (statStreamsEl) statStreamsEl.textContent = allMatches.reduce((a, m) => a + (m.streamCount || 0), 0);

    // Sport counts
    const soccerCountEl  = document.getElementById('soccerCount');
    const cricketCountEl = document.getElementById('cricketCount');
    if (soccerCountEl)  soccerCountEl.textContent  = `${soccerToday.length} match${soccerToday.length !== 1 ? 'es' : ''} today`;
    if (cricketCountEl) cricketCountEl.textContent = `${cricketToday.length} match${cricketToday.length !== 1 ? 'es' : ''} today`;

    // Render live
    if (liveGrid) {
      liveGrid.innerHTML = liveMatches.length
        ? liveMatches.map(m => buildMatchCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">📡</div><h3>No Live Matches</h3><p>Check the schedule for upcoming games.</p></div>';
    }

    // Render soccer
    if (soccerGrid) {
      const toShow = soccerToday.slice(0, 8);
      soccerGrid.innerHTML = toShow.length
        ? toShow.map(m => buildMatchCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">⚽</div><h3>No Soccer Today</h3><p>No soccer matches scheduled for today.</p></div>';
    }

    // Render cricket
    if (cricketGrid) {
      const toShow = cricketToday.slice(0, 8);
      cricketGrid.innerHTML = toShow.length
        ? toShow.map(m => buildMatchCard(m)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">🏏</div><h3>No Cricket Today</h3><p>No cricket matches scheduled for today.</p></div>';
    }

    // Render upcoming (with countdowns)
    if (upcomingGrid) {
      if (upcoming.length) {
        upcomingGrid.innerHTML = upcoming.map(m => {
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
                <span class="match-time" style="font-size:0.72rem">${formatFullDateTime(startDate)}</span>
              </div>
            </div>
          `;
        }).join('');

        // Start countdowns
        upcoming.forEach(m => {
          const el = document.getElementById(`countdown-${m.id}`);
          if (el && m.startTime) startCountdown(tsToDate(m.startTime), el);
        });
      } else {
        upcomingGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No Upcoming Matches</h3><p>Check back later.</p></div>';
      }
    }

  } catch (err) {
    console.error('Error loading home data:', err);
    if (liveGrid)    liveGrid.innerHTML    = '<div class="empty-state"><p>Could not load matches. Please refresh.</p></div>';
    if (soccerGrid)  soccerGrid.innerHTML  = '';
    if (cricketGrid) cricketGrid.innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', loadHome);
