// ============================================================
// STRIMO — Auto Admin (Soccer + Cricket)
// Fetches from leagues and detects live matches
// ============================================================

// Show debug info in console
async function autoFetchMatches() {
  const resultsEl = document.getElementById('autoFetchResults');
  if (resultsEl) resultsEl.innerHTML = '<p>Fetching matches from API... (check console for debug)</p>';

  try {
    console.log('=== Starting Auto-Fetch ===');
    const result = await fetchTodayMatches();
    console.log('=== Results ===', result);

    // Count by status
    const liveCount = result.all.filter(m => m.status === 'live').length;
    const upcomingCount = result.all.filter(m => m.status === 'upcoming').length;

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-elevated);border-radius:var(--radius-md)">
          <h4>📅 Match Schedule</h4>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:15px">
            Note: Open browser console (F12) to see API debug info
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px">
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
                  ${result.soccer.slice(0, 10).map(m => `
                    <li style="margin-bottom:4px">${m.homeTeam} vs ${m.awayTeam} - ${m.league} ${m.status === 'live' ? '🔴' : ''}</li>
                  `).join('')}
                </ul>
              ` : '<p style="font-size:0.8rem;color:var(--text-muted)">No soccer matches found</p>'}
            </div>
            <div>
              <h5 style="color:var(--accent-orange)">🏏 Cricket: ${result.cricket.length}</h5>
              ${result.cricket.length > 0 ? `
                <ul style="font-size:0.8rem;margin-top:8px;padding-left:15px;color:var(--text-muted)">
                  ${result.cricket.slice(0, 10).map(m => `
                    <li style="margin-bottom:4px">${m.homeTeam} vs ${m.awayTeam} - ${m.league} ${m.status === 'live' ? '🔴' : ''}</li>
                  `).join('')}
                </ul>
              ` : '<p style="font-size:0.8rem;color:var(--text-muted)">No cricket matches found</p>'}
            </div>
          </div>
          ${result.all.length === 0 ? `
            <p style="margin-top:15px;color:var(--accent-live);font-size:0.85rem">
              ⚠️ No matches found. The free API has limited data. You may need to add matches manually or use a different data source.
            </p>
          ` : ''}
        </div>
      `;
    }

    return result;
  } catch (err) {
    console.error('Auto-fetch error:', err);
    if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}<br>Check console for details.</p>`;
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
      resultsEl.innerHTML = '<p>Scanning streaming sites...</p>';
    }

    // Scan for streams
    const scanner = new StreamScanner();
    const streamResults = await scanner.scanAllSources((current, total, url) => {
      if (resultsEl) resultsEl.innerHTML = `<p>Scanning ${current}/${total}: ${url}</p>`;
    });

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Adding matches to database...</p>';
    }

    // Get existing matches
    const existingSnap = await db.collection('matches').get();
    const existingSet = new Set(existingSnap.docs.map(d => {
      const data = d.data();
      return `${data.homeTeam}-${data.awayTeam}-${data.sport}`;
    }));

    let soccerAdded = 0;
    let cricketAdded = 0;
    let skipped = 0;

    for (const match of allMatches) {
      const key = `${match.homeTeam}-${match.awayTeam}-${match.sport}`;

      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      // Try to find matching stream
      const homeKey = match.homeTeam.toLowerCase().split(' ')[0];
      const awayKey = match.awayTeam.toLowerCase().split(' ')[0];

      const matchStreams = streamResults
        .flatMap(r => r.links)
        .filter(link => {
          const l = link.toLowerCase();
          return l.includes(homeKey) || l.includes(awayKey);
        });

      // Add match (even without streams - that's ok!)
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
          label: 'Auto-Detected',
          type: 'm3u8',
          url: matchStreams[0],
          quality: 'hd',
          isActive: true,
          order: 0
        });
      }

      existingSet.add(key);

      if (match.sport === 'cricket') cricketAdded++;
      else soccerAdded++;
    }

    const totalLinks = streamResults.reduce((a, r) => a + r.links.length, 0);

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-success);border-radius:var(--radius-md);color:white">
          <h4>✓ Done!</h4>
          <p><strong>Found:</strong> ⚽ ${matchResult.soccer.length} soccer | 🏏 ${matchResult.cricket.length} cricket</p>
          <p><strong>Added:</strong> ⚽ ${soccerAdded} soccer | 🏏 ${cricketAdded} cricket</p>
          <p><strong>Skipped:</strong> ${skipped} (already existed)</p>
          <p style="margin-top:10px;font-size:0.85rem;opacity:0.8">
            Streams scanned: ${streamResults.length} | Links found: ${totalLinks}
          </p>
        </div>
      `;
    }

    showToast(`Added ${soccerAdded + cricketAdded} matches!`, 'success');

  } catch (err) {
    console.error('Auto-scan error:', err);
    if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
    showToast('Failed: ' + err.message, 'error');
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = '🔄 Auto-Fetch & Scan';
  }
}

window.autoFetchMatches = autoFetchMatches;
window.autoCreateMatches = autoCreateMatches;