// firebase-config.js  – version ES modules pour navigateur

// Import des SDK Firebase hébergés (pas besoin de NPM ou bundler)
import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* Copie/colle EXACTEMENT ce bloc depuis
   Firebase Console ▸ ⚙️ Project settings ▸ General ▸ SDK setup and configuration
   ⚠️ garde les guillemets, ne modifie pas appspot/app ». */
const firebaseConfig = {
  apiKey:            "AIzaSyCBLfRsdRwtEnsfVlEQIBXjvD7KIN1W8rs",
  authDomain:        "damage-check-b6007.firebaseapp.com",
  projectId:         "damage-check-b6007",
  storageBucket:     "damage-check-b6007.appspot.com",
  messagingSenderId: "363707047443",
  appId:             "1:363707047443:web:de9c941229ca070193e9e6"
};

// Initialisation de l'app puis export de la base Firestore
export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
