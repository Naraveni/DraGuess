
# ScribbleSync

A high-performance, realtime multiplayer drawing and guessing game built with React, Tailwind, and Firebase.

## Features
- 🎨 Realtime canvas synchronization
- 💬 Live chat with guess detection
- 🏆 Automatic scoring and leaderboard
- 🎮 Matchmaking (Public/Private rooms)
- 👤 Anonymous authentication

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally
```bash
npm run dev
```

### 3. Deploying to Firebase
To use real Firebase instead of the mock data:
1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Anonymous Authentication**.
3. Create a **Firestore Database**.
4. Update `firebaseConfig.ts` with your credentials.

---

## How to Push to GitHub

1. **Create a new repository** on [GitHub](https://github.com/new). Do not initialize it with a README or .gitignore.

2. **Open your terminal** in the project root and run:

```bash
# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: ScribbleSync MVP"

# Link to your GitHub repo (Replace with your actual URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Rename branch to main
git branch -M main

# Push the code
git push -u origin main
```

## Data Schema (Firestore)

- `rooms/{roomId}`
  - `status`: "waiting" | "playing" | "ended"
  - `visibility`: "public" | "private"
  - `drawerId`: string
  - `currentWord`: string
  - `timer`: number
  - `playerCount`: number
  - `strokes/` (Sub-collection)
    - `points`: {x, y}[]
    - `color`: string
    - `width`: number
  - `players/` (Sub-collection)
    - `name`: string
    - `score`: number
    - `hasGuessed`: boolean
  - `messages/` (Sub-collection)
    - `text`: string
    - `isCorrect`: boolean
