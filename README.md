
# ScribbleSync

A high-performance, realtime multiplayer drawing and guessing game built with React, Tailwind, and Firebase.

## Quick Start

1.  **Clone & Install**
    ```bash
    npm install
    ```

2.  **Firebase Setup**
    *   Create a project at [Firebase Console](https://console.firebase.google.com/).
    *   Enable **Anonymous Auth**.
    *   Enable **Firestore**.
    *   **CRITICAL**: Copy the contents of `firestore.rules` into the Firebase Console -> Firestore -> Rules tab.
    *   Update `firebaseConfig.ts` with your web app credentials.

3.  **Run**
    ```bash
    npm run dev
    ```

## Game Rules
*   **Matchmaking**: Join public rooms or share a private code.
*   **Drawing**: Use the brush tools when it's your turn.
*   **Guessing**: Type in chat. Faster guesses = More points!
*   **Rounds**: Game ends after 3 full rounds (everyone draws 3 times).

## GitHub Deploy
Follow the standard git process provided in the initialization message to push your final code.
