// ============================================================
// STRIMO — Auto Admin (Soccer + Cricket)
// Safe initialization - won't break page if worker fails
// ============================================================

// Wrap everything in try-catch so page still works
(function() {
  try {
    // Auto-fetch today's matches
    window.autoFetchMatches = async function() {
      const resultsEl = document.getElementById('autoFetchResults');
      if (resultsEl) resultsEl.innerHTML = '<p>Fetching matches from API...</p>';

      try {
        const result = await window.fetchTodayMatches();

        const liveCount = result.all.filter(m => m.status === 'live').length;
        const upcomingCount = result.all.filter(m => m.status === 'upcoming').length;

        if (resultsEl) {
          resultsEl.innerHTML = `
            <div style="padding:15px;background:var(--bg-elevated);border-radius:var(--radius-md)">
              <h4>📅 Match Schedule</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:15px 0">
                <div style="text-align:center;padding:10px;background:var(--accent-live-dim);border-radius:var(--radius-sm)">
                  <div style="font-size:1.5rem;font-weight:bold">${liveCount}</div>
                  <div style="font-size:0.75rem">🔴 LIVE</div>
                </div>
                <div style="text-align:center;padding:10px;background:var(--accent-blue-dim);border-radius:var(--radius-sm)">
                  <div style="font-size:1.5rem;font-weight:bold">${upcomingCount}</div>
                  <div style="font-size:0.75rem">⏰ Upcoming</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                <div>
                  <h5 style="color:var(--accent-blue)">⚽ Soccer: ${result.soccer.length}</h5>
                  ${result.soccer.length > 0 ? `
                    <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                      ${result.soccer.slice(0, 5).map(m => `<li>${m.homeTeam} vs ${m.awayTeam}</li>`).join('')}
                    </ul>
                  ` : '<p style="font-size:0.8rem">No matches found</p>'}
                </div>
                <div>
                  <h5 style="color:var(--accent-orange)">🏏 Cricket: ${result.cricket.length}</h5>
                  ${result.cricket.length > 0 ? `
                    <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                      ${result.cricket.slice(0, 5).map(m => `<li>${m.homeTeam} vs ${m.awayTeam}</li>`).join('')}
                    </ul>
                  ` : '<p style="font-size:0.8rem">No matches found</p>'}
                </div>
              </div>
            </div>
          `;
        }

        return result;
      } catch (err) {
        console.error('Error fetching matches:', err);
        if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
        return { soccer: [], cricket: [], all: [] };
      }
    };

    // Auto-scan and add matches
    window.autoCreateMatches = async function() {
      const btn = document.getElementById('autoScanBtn');
      const resultsEl = document.getElementById('autoScanResults');

      if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }

      try {
        const matchResult = await window.fetchTodayMatches();
        const allMatches = matchResult.all;

        if (resultsEl) resultsEl.innerHTML = '<p>Found matches, adding to database...</p>';

        // Get existing matches
        const existingSnap = await db.collection('matches').get();
        const existingSet = new Set(existingSnap.docs.map(d => {
          const data = d.data();
          return `${data.homeTeam}-${data.awayTeam}-${data.sport}`;
        }));

        let soccerAdded = 0;
        let cricketAdded = 0;

        for (const match of allMatches) {
          const key = `${match.homeTeam}-${match.awayTeam}-${match.sport}`;
          if (existingSet.has(key)) continue;

          await db.collection('matches').add({
            sport: match.sport,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.league,
            startTime: match.startTime ? firebase.firestore.Timestamp.fromDate(match.startTime) : null,
            status: match.status || 'upcoming',
            featured: false,
            autoAdded: true,
            createdAt: window.nowTimestamp(),
            updatedAt: window.nowTimestamp()
          });

          existingSet.add(key);
          if (match.sport === 'cricket') cricketAdded++;
          else soccerAdded++;
        }

        if (resultsEl) {
          resultsEl.innerHTML = `
            <div style="padding:15px;background:var(--bg-success);border-radius:var(--radius-md);color:white">
              <h4>✓ Done!</h4>
              <p>Found: ⚽ ${matchResult.soccer.length} | 🏏 ${matchResult.cricket.length}</p>
              <p>Added: ⚽ ${soccerAdded} | 🏏 ${cricketAdded}</p>
            </div>
          `;
        }

        if (window.showToast) window.showToast(`Added ${soccerAdded + cricketAdded} matches!`, 'success');

      } catch (err) {
        console.error('Auto-scan error:', err);
        if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
        if (window.showToast) window.showToast('Failed: ' + err.message, 'error');
      }

      if (btn) { btn.disabled = false; btn.textContent = '🔄 Auto-Fetch & Scan'; }
    };

    console.log('Auto-admin loaded');
  } catch (e) {
    console.error('Auto-admin init error:', e);
  }
})();