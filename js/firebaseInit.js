// firebaseInit.js
// -------------------------------------------
// Инициализация Firebase для всего PolyTalky
// -------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ------------------------------
// Твой Firebase config
// ------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyBAU_uMTePpKwVNZNhqk2pss2PuSitGfQI",
      authDomain: "polytalky-70999.firebaseapp.com",
      projectId: "polytalky-70999",
      storageBucket: "polytalky-70999.firebasestorage.app",
      messagingSenderId: "62407152289",
      appId: "1:62407152289:web:b0c0efdb2472f12b10d6e0"
    };
// ------------------------------
// Инициализация
// ------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------
// Доступ глобально
// ------------------------------
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;

console.log("%c[PolyTalky] Firebase успешно инициализирован", "color: #10b981");
