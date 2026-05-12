// ============================================================
// STRIMO — Firebase Configuration
// Replace the config values below with your Firebase project's config
// See README.md for full setup instructions
// ============================================================

// STEP 1: Replace these values with your Firebase project config
// Go to: Firebase Console → Project Settings → Your apps → SDK setup
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ============================================================
// Firebase Initialization (using CDN modules via compat)
// ============================================================

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export commonly used services
const db   = firebase.firestore();
const auth = firebase.auth();

// ============================================================
// Firestore Data Schema Reference
// ============================================================
/*
Collection: matches
  Document ID: auto-generated
  Fields:
    sport:      "soccer" | "cricket"
    homeTeam:   string
    awayTeam:   string
    league:     string
    tournament: string  (optional)
    startTime:  Timestamp
    status:     "upcoming" | "live" | "completed"
    featured:   boolean
    createdAt:  Timestamp
    updatedAt:  Timestamp

Sub-collection: matches/{matchId}/streams
  Document ID: auto-generated
  Fields:
    label:    string  (e.g., "HD Stream 1", "Mirror", "SD")
    type:     "m3u8" | "iframe" | "external"
    url:      string
    quality:  "hd" | "sd" | "unknown"
    isActive: boolean
    order:    number
*/

// ============================================================
// Helper: Firestore timestamp for now
// ============================================================
function nowTimestamp() {
  return firebase.firestore.Timestamp.now();
}

// ============================================================
// Helper: Convert Firestore Timestamp to JS Date
// ============================================================
function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}
