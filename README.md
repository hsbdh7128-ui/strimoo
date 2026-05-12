# Strimo — Sports Streaming Aggregator

A dark-themed, premium sports link aggregator for **Soccer & Cricket**. Aggregates publicly available stream links. Does not host or stream any content directly.

---

## 🚀 Quick Start

### 1. Firebase Setup

#### A) Create Firebase Project
1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **"Add project"** → name it `strimo` → Continue
3. Disable Google Analytics (optional) → **Create project**

#### B) Enable Firestore
1. In your Firebase project → left sidebar → **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → select your region (e.g., `us-central1`) → **Done**

#### C) Set Firestore Security Rules
In Firestore → **Rules** tab, paste this:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for matches and streams
    match /matches/{matchId} {
      allow read: if true;
      allow write: if request.auth != null;

      match /streams/{streamId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
  }
}
```
Click **Publish**.

#### D) Enable Authentication
1. Left sidebar → **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method** → enable **Email/Password**
4. Go to **Users** tab → **"Add user"**
5. Enter your admin email + password → **Add user**

#### E) Get Firebase Config
1. Project Settings (gear icon) → **Your apps** → **Web app** (</> icon)
2. Register app with name `strimo-web`
3. Copy the `firebaseConfig` object

#### F) Update firebase-config.js
Open `js/firebase-config.js` and replace the placeholder values:
```js
const firebaseConfig = {
  apiKey:            "AIza...",          // ← Your actual values
  authDomain:        "strimo-xxx.firebaseapp.com",
  projectId:         "strimo-xxx",
  storageBucket:     "strimo-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

---

### 2. Cloudflare Worker Setup (m3u8 Auto-Detector)

#### A) Deploy the Worker
1. Go to [https://dash.cloudflare.com/](https://dash.cloudflare.com/) → **Workers & Pages**
2. Click **"Create"** → **"Create Worker"**
3. Name it `strimo-m3u8-detector`
4. Click **"Edit code"**
5. Delete the default code and paste the contents of `workers/m3u8-detector.js`
6. Click **"Deploy"**
7. Note your Worker URL: `https://strimo-m3u8-detector.YOUR-SUBDOMAIN.workers.dev`

#### B) Update Admin JS
Open `js/admin.js` and update line 5:
```js
const WORKER_URL = 'https://strimo-m3u8-detector.YOUR-SUBDOMAIN.workers.dev';
```
Replace `YOUR-SUBDOMAIN` with your actual Cloudflare subdomain.

---

### 3. Deploy to Cloudflare Pages

#### A) Push to GitHub
```bash
git init
git add .
git commit -m "Initial Strimo deployment"
git remote add origin https://github.com/YOUR-USERNAME/strimo.git
git push -u origin main
```

#### B) Connect to Cloudflare Pages
1. Cloudflare Dashboard → **Workers & Pages** → **"Create"** → **"Pages"**
2. Click **"Connect to Git"** → authorize GitHub → select your `strimo` repo
3. Build settings:
   - **Framework preset**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/`
4. Click **"Save and Deploy"**
5. Your site will be live at: `https://strimo.pages.dev` (or a similar auto-generated name)

#### C) Custom Domain (Optional)
Pages → your project → **Custom domains** → add `strimo.pages.dev` or your own domain.

---

## 📡 How to Add a Match (Admin Workflow)

1. Open `https://strimo.pages.dev/admin.html`
2. Sign in with your Firebase admin email + password
3. Click **"Add Match"**
4. Fill in: Sport, Teams, League, Date/Time, Status
5. **To find the m3u8 URL:**
   - Open the streaming site in another tab
   - Press **F12** → **Network** tab → start the stream
   - Filter by `.m3u8` in the Network tab
   - Copy the m3u8 URL
   - Paste it in the **Auto-Detect** box OR directly in the stream URL field
6. Click **"+ Add to List"** → **"Save Match"**

---

## 📁 File Structure

```
strimo/
├── index.html          ← Home page
├── soccer.html         ← Soccer matches
├── cricket.html        ← Cricket matches
├── match.html          ← Match/stream page (HLS player)
├── schedule.html       ← Full schedule
├── search.html         ← Search page
├── disclaimer.html     ← Legal/DMCA page
├── admin.html          ← Admin panel (password protected)
├── css/
│   ├── variables.css   ← Design tokens
│   ├── base.css        ← Reset + typography
│   ├── components.css  ← UI components
│   ├── main.css        ← Page layouts
│   ├── player.css      ← Video player styles
│   └── admin.css       ← Admin panel styles
├── js/
│   ├── firebase-config.js  ← ⚠️ UPDATE THIS WITH YOUR CONFIG
│   ├── utils.js            ← Shared utilities
│   ├── home.js
│   ├── soccer.js
│   ├── cricket.js
│   ├── match.js            ← HLS.js player
│   ├── schedule.js
│   ├── search.js
│   └── admin.js            ← ⚠️ UPDATE WORKER_URL
└── workers/
    └── m3u8-detector.js    ← Deploy to Cloudflare Workers
```

---

## ⚠️ Legal Disclaimer

Strimo is a link aggregator only. It does not host, upload, or stream any video content. All streams link to publicly available third-party content. All content copyright belongs to its respective owners. See `disclaimer.html` for full legal text.

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 + Vanilla CSS + Vanilla JS |
| Video Player | Video.js 8 + HLS.js 1.5 |
| Database | Firebase Firestore |
| Auth (Admin) | Firebase Authentication |
| m3u8 Detector | Cloudflare Worker |
| Hosting | Cloudflare Pages |
| Fonts | Google Fonts (Rajdhani + Inter) |
