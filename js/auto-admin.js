// ============================================================
// STRIMO — Auto Admin (Soccer + Cricket)
// Fetches from multiple leagues and detects live matches
// ============================================================

// Auto-fetch today's matches
async function autoFetchMatches() {
  const resultsEl = document.getElementById('autoFetchResults');
  if (resultsEl) resultsEl.innerHTML = '<p>Fetching matches from API...</p>';

  try {
    const result = await fetchTodayMatches();

    // Count by status
    const liveCount = result.all.filter(m => m.status === 'live').length;
    const upcomingCount = result.all.filter(m => m.status === 'upcoming').length;
    const completedCount = result.all.filter(m => m.status === 'completed').length;

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-elevated);border-radius:var(--radius-md)">
          <h4>📅 Match Schedule</h4>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0">
            <div style="text-align:center;padding:10px;background:var(--accent-live-dim);border-radius:var(--radius-sm)">
              <div style="font-size:1.5rem;font-weight:bold">${liveCount}</div>
              <div style="font-size:0.75rem">🔴 LIVE</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--accent-blue-dim);border-radius:var(--radius-sm)">
              <div style="font-size:1.5rem;font-weight:bold">${upcomingCount}</div>
              <div style="font-size:0.75rem">⏰ Upcoming</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-dark);border-radius:var(--radius-sm)">
              <div style="font-size:1.5rem;font-weight:bold">${completedCount}</div>
              <div style="font-size:0.75rem">✅ Completed</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:15px">
            <div>
              <h5 style="color:var(--accent-blue)">⚽ Soccer: ${result.soccer.length}</h5>
              <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                ${result.soccer.slice(0, 8).map(m =>
                  `<li style="margin-bottom:4px">${m.homeTeam} vs ${m.awayTeam} <span style="color:${m.status === 'live' ? 'var(--accent-live)' : ''}">${m.status === 'live' ? '🔴' : ''}</span></li>`
                ).join('')}
                ${result.soccer.length > 8 ? `<li>...and ${result.soccer.length - 8} more</li>` : ''}
              </ul>
            </div>
            <div>
              <h5 style="color:var(--accent-orange)">🏏 Cricket: ${result.cricket.length}</h5>
              <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                ${result.cricket.slice(0, 8).map(m =>
                  `<li style="margin-bottom:4px">${m.homeTeam} vs ${m.awayTeam} <span style="color:${m.status === 'live' ? 'var(--accent-live)' : ''}">${m.status === 'live' ? '🔴' : ''}</span></li>`
                ).join('')}
                ${result.cricket.length > 8 ? `<li>...and ${result.cricket.length - 8} more</li>` : ''}
              </ul>
            </div>
          </div>
        </div>
      `;
    }

    return result;
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
    return { soccer: [], cricket: [], all: [] };
  }
}

// Auto-scan and add matches
async function autoCreateMatches() {
  const btn = document.getElementById('autoScanBtn');
  const resultsEl = document.getElementById('autoScanResults');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }

  try {
    // Get matches from API
    const matchResult = await fetchTodayMatches();
    const allMatches = matchResult.all;

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Scanning streaming sites for live links...</p>';
    }

    // Scan for streams
    const scanner = new StreamScanner();
    const streamResults = await scanner.scanAllSources((current, total, url) => {
      if (resultsEl) {
        resultsEl.innerHTML = `<p>Scanning ${current}/${total}: ${url}</p>`;
      }
    });

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Matching teams and adding to database...</p>';
    }

    // Get existing matches to avoid duplicates
    const existingSnap = await db.collection('matches').get();
    const existingMatches = new Set(existingSnap.docs.map(d => {
      const data = d.data();
      return `${data.homeTeam}-${data.awayTeam}-${data.sport}`;
    }));

    let soccerAdded = 0;
    let cricketAdded = 0;
    let skipped = 0;

    for (const match of allMatches) {
      const matchKey = `${match.homeTeam}-${match.awayTeam}-${match.sport}`;

      // Skip if already exists
      if (existingMatches.has(matchKey)) {
        skipped++;
        continue;
      }

      // Find matching streams
      const homeKey = match.homeTeam.toLowerCase().split(' ')[0];
      const awayKey = match.awayTeam.toLowerCase().split(' ')[0];

      const matchStreams = streamResults
        .flatMap(r => r.links)
        .filter(link => {
          const linkLower = link.toLowerCase();
          return linkLower.includes(homeKey) || linkLower.includes(awayKey);
        });

      // Add match with or without streams
      const matchRef = await db.collection('matches').add({
        sport: match.sport,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        startTime: match.startTime ? firebase.firestore.Timestamp.fromDate(match.startTime) : null,
        status: match.status,
        featured: false,
        autoAdded: true,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      });

      // Add stream if found
      if (matchStreams.length > 0) {
        await db.collection('matches').doc(matchRef.id).collection('streams').add({
          label: 'Auto-Detected Stream',
          type: 'm3u8',
          url: matchStreams[0],
          quality: 'hd',
          isActive: true,
          order: 0
        });
      }

      existingMatches.add(matchKey);

      if (match.sport === 'cricket') {
        cricketAdded++;
      } else {
        soccerAdded++;
      }
    }

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-success);border-radius:var(--radius-md);color:white">
          <h4>✓ Auto-scan complete!</h4>
          <p style="margin-top:10px"><strong>Found in API:</strong></p>
          <p>⚽ ${matchResult.soccer.length} soccer | 🏏 ${matchResult.cricket.length} cricket</p>
          <p style="margin-top:10px"><strong>Added to database:</strong></p>
          <p>⚽ ${soccerAdded} soccer | 🏏 ${cricketAdded} cricket</p>
          <p>⏭️ Skipped (already exist): ${skipped}</p>
          <p style="margin-top:10px;font-size:0.85rem;opacity:0.8">
            Stream sources scanned: ${streamResults.length} | Links found: ${streamResults.reduce((a, r) => a + r.links.length, 0)}
          </p>
        </div>
      `;
    }

    showToast(`Added ${soccerAdded + cricketAdded} matches!`, 'success');

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