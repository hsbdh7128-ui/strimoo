// ============================================================
// STRIMO — Auto Admin Integration
// Combines match fetching + stream scanning
// ============================================================

// Auto-fetch today's matches and add to Firestore
async function autoFetchMatches() {
  const resultsEl = document.getElementById('autoFetchResults');
  if (resultsEl) resultsEl.innerHTML = '<p>Fetching matches from API...</p>';

  try {
    // Fetch soccer matches
    const soccerMatches = await fetchTodayMatches('soccer');

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-elevated);border-radius:var(--radius-md)">
          <h4>Found ${soccerMatches.length} matches today</h4>
          <ul style="margin-top:10px;padding-left:20px">
            ${soccerMatches.slice(0, 10).map(m =>
              `<li>${m.homeTeam} vs ${m.awayTeam} - ${m.league}</li>`
            ).join('')}
            ${soccerMatches.length > 10 ? `<li>...and ${soccerMatches.length - 10} more</li>` : ''}
          </ul>
        </div>
      `;
    }

    return soccerMatches;
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<p style="color:var(--accent-live)">Error: ${err.message}</p>`;
    return [];
  }
}

// Auto-scan for streams and create matches
async function autoCreateMatches() {
  const btn = document.getElementById('autoScanBtn');
  const resultsEl = document.getElementById('autoScanResults');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }

  try {
    // First get matches from API
    const matches = await fetchTodayMatches('soccer');

    // Then scan for streams
    const scanner = new StreamScanner();

    if (resultsEl) {
      resultsEl.innerHTML = '<p>Scanning streaming sites for live links...</p>';
    }

    const streamResults = await scanner.scanAllSources((current, total, url) => {
      if (resultsEl) {
        resultsEl.innerHTML = `<p>Scanning ${current}/${total}: ${url}</p>`;
      }
    });

    // Auto-add matches that have streams
    let added = 0;
    for (const match of matches) {
      // Find matching streams
      const matchStreams = streamResults
        .flatMap(r => r.links)
        .filter(link =>
          link.toLowerCase().includes(match.homeTeam.toLowerCase().split(' ')[0]) ||
          link.toLowerCase().includes(match.awayTeam.toLowerCase().split(' ')[0])
        );

      if (matchStreams.length > 0) {
        // Add match to Firestore
        await db.collection('matches').add({
          ...match,
          startTime: match.startTime ? firebase.firestore.Timestamp.fromDate(match.startTime) : null,
          status: 'upcoming',
          autoAdded: true,
          createdAt: nowTimestamp()
        });

        added++;
      }
    }

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="padding:15px;background:var(--bg-success);border-radius:var(--radius-md);color:white">
          <h4>✓ Auto-scan complete!</h4>
          <p>Found ${matches.length} matches today.</p>
          <p>Found streams on ${streamResults.filter(r => r.links.length > 0).length} sites.</p>
          <p>Added ${added} matches with streams to your database.</p>
        </div>
      `;
    }

    showToast(`Auto-added ${added} matches with streams!`, 'success');

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