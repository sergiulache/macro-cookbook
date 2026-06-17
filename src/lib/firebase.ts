import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Public client config (not a secret - safe to commit). Project: macro-cookbook.
const firebaseConfig = {
  apiKey: "AIzaSyDk02SZbiVAgPlgOlMogan80NPOoyYE3iE",
  authDomain: "macro-cookbook.firebaseapp.com",
  projectId: "macro-cookbook",
  storageBucket: "macro-cookbook.firebasestorage.app",
  messagingSenderId: "111946480296",
  appId: "1:111946480296:web:d3993ad3714e3c3c97a09d",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// AI proxy lives in europe-west1 (see functions/index.js)
export const functions = getFunctions(app, "europe-west1");
