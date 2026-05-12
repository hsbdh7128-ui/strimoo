// ============================================================
// STRIMO — Auto Admin Integration (Both Soccer & Cricket)
// Combines match fetching + stream scanning
// ============================================================

// Auto-fetch today's matches for both sports
async function autoFetchMatches() {
  const resultsEl = document.getElementById('autoFetchResults');
  if (resultsEl) resultsEl.innerHTML = '<p>Fetching matches from API...</p>';

  try {
    // Fetch both soccer and cricket matches
    const result = await fetchTodayMatches();

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-elevated);border-radius:var(--radius-md)">
          <h4>Today's Matches</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:15px">
            <div>
              <h5 style="color:var(--accent-blue)">⚽ Soccer: ${result.soccer.length}</h5>
              <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                ${result.soccer.slice(0, 5).map(m =>
                  `<li>${m.homeTeam} vs ${m.awayTeam}</li>`
                ).join('')}
                ${result.soccer.length > 5 ? `<li>...and ${result.soccer.length - 5} more</li>` : ''}
              </ul>
            </div>
            <div>
              <h5 style="color:var(--accent-orange)">🏏 Cricket: ${result.cricket.length}</h5>
              <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                ${result.cricket.slice(0, 5).map(m =>
                  `<li>${m.homeTeam} vs ${m.awayTeam}</li>`
                ).join('')}
                ${result.cricket.length > 5 ? `<li>...and ${result.cricket.length - 5} more</li>` : ''}
              </ul>
            </div>
          </div>
          <p style="margin-top:15px;font-size:0.85rem;color:var(--text-muted)">
            Total: ${result.all.length} matches today
          </p>
        </div>
      `;
    }

    return result;
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
    return { soccer: [], cricket: [], all: [] };
  }
}

// Auto-scan for streams and create matches (both sports)
async function autoCreateMatches() {
  const btn = document.getElementById('autoScanBtn');
  const resultsEl = document.getElementById('autoScanResults');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }

  try {
    // Get matches for both sports
    const matchResult = await fetchTodayMatches();
    const allMatches = matchResult.all;

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Fetching matches from API...</p>';
    }

    // Scan for streams
    const scanner = new StreamScanner();

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Scanning streaming sites for live links...</p>';
    }

    const streamResults = await scanner.scanAllSources((current, total, url) => {
      if (resultsEl) {
        resultsEl.innerHTML = `<p>Scanning ${current}/${total}: ${url}</p>`;
      }
    });

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Matching teams and adding matches...</p>';
    }

    // Auto-add matches that have streams
    let soccerAdded = 0;
    let cricketAdded = 0;

    for (const match of allMatches) {
      // Find matching streams based on team names
      const homeKey = match.homeTeam.toLowerCase().split(' ')[0];
      const awayKey = match.awayTeam.toLowerCase().split(' ')[0];

      const matchStreams = streamResults
        .flatMap(r => r.links)
        .filter(link => {
          const linkLower = link.toLowerCase();
          return linkLower.includes(homeKey) || linkLower.includes(awayKey);
        });

      if (matchStreams.length > 0) {
        // Add match to Firestore with first stream
        await db.collection('matches').add({
          sport: match.sport,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          startTime: match.startTime ? firebase.firestore.Timestamp.fromDate(match.startTime) : null,
          status: 'upcoming',
          featured: false,
          autoAdded: true,
          createdAt: nowTimestamp(),
          updatedAt: nowTimestamp()
        });

        // Add stream
        const matchDoc = await db.collection('matches')
          .where('homeTeam', '==', match.homeTeam)
          .where('awayTeam', '==', match.awayTeam)
          .limit(1)
          .get();

        if (!matchDoc.empty) {
          const matchId = matchDoc.docs[0].id;
          await db.collection('matches').doc(matchId).collection('streams').add({
            label: 'Auto-Detected Stream',
            type: 'm3u8',
            url: matchStreams[0],
            quality: 'hd',
            isActive: true,
            order: 0
          });
        }

        if (match.sport === 'cricket') {
          cricketAdded++;
        } else {
          soccerAdded++;
        }
      }
    }

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-success);border-radius:var(--radius-md);color:white">
          <h4>✓ Auto-scan complete!</h4>
          <p style="margin-top:10px">
            <strong>Today's Schedule:</strong><br>
            ⚽ Soccer: ${matchResult.soccer.length} matches<br>
            🏏 Cricket: ${matchResult.cricket.length} matches
          </p>
          <p style="margin-top:10px">
            <strong>Added to site:</strong><br>
            ⚽ ${soccerAdded} soccer matches with streams<br>
            🏏 ${cricketAdded} cricket matches with streams
          </p>
          <p style="margin-top:10px;font-size:0.85rem;opacity:0.8">
            Stream sources scanned: ${streamResults.length}
          </p>
        </div>
      `;
    }

    showToast(`Auto-added ${soccerAdded + cricketAdded} matches with streams!`, 'success');

  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
    showToast('Auto-scan failed: ' + err.message, 'error');
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = '🔄 Auto-Fetch & Scan';
  }
}

// Export
window.autoFetchMatches = autoFetchMatches;
window.autoCreateMatches = autoCreateMatches;