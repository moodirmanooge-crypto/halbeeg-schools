//src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

/* ===========================================================
   HALBEEG SCHOOLS — MULTI-TENANT (NEW DATABASE)
   Firestore + Storage = rawaan-online-shop
=========================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCXOp6MPnwArV0NiPPAmkBBKdvQoc0gadk",
  authDomain: "rawaan-online-shop.firebaseapp.com",
  projectId: "rawaan-online-shop",
  storageBucket: "rawaan-online-shop.firebasestorage.app",
  messagingSenderId: "492970437433",
  appId: "1:492970437433:web:92363b34f8407b596b56e8",
  measurementId: "G-FHNW9QG7DP",
};

const halbeegApp = initializeApp(firebaseConfig, "halbeeg");

/* ===========================================================
   EXPORTS
=========================================================== */

export const db = getFirestore(halbeegApp);          // Firestore - rawaan-online-shop
export const auth = getAuth(halbeegApp);             // Auth
export const storage = getStorage(halbeegApp);       // Storage - rawaan-online-shop
export const functions = getFunctions(halbeegApp, "us-central1");

export { halbeegApp };
export const app = halbeegApp;

export default halbeegApp;