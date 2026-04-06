// src/lib/firebase.js
// Replace the placeholder values below with your Firebase project config.
// Get them from: console.firebase.google.com → Project Settings → Your Apps → Web
// Until then the app runs in DEMO MODE with sample data — no setup needed.

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "protfolio-os.firebaseapp.com",
  projectId: "protfolio-os",
  storageBucket: "protfolio-os.firebasestorage.app",
  messagingSenderId: "792197649360",
  appId: "1:792197649360:web:27f4feb6bcd7d8bfde5fd5"
};

// Detect placeholder — switch to demo mode automatically
export const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY"

let app = null
export let db   = null
export let auth = null

if (!IS_DEMO) {
  app  = initializeApp(firebaseConfig)
  db   = getFirestore(app)
  auth = getAuth(app)
}

export default app
