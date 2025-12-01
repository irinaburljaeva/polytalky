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
  apiKey: "AIzaSyC-lSpXvd55g0Wx7a8DsU8x0OikYC32Y90",
  authDomain: "polytalky.firebaseapp.com",
  projectId: "polytalky",
  storageBucket: "polytalky.appspot.com",
  messagingSenderId: "896099750207",
  appId: "1:896099750207:web:3fc8ab4b49f83ca92fd40d"
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
