// firebase-config.js
import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCBLfRsdRwtEnsfVlEQIBXjvD7KIN1W8rs",
  authDomain:        "damage-check-b6007.firebaseapp.com",
  projectId:         "damage-check-b6007",
  storageBucket:     "damage-check-b6007.firebasestorage.app",
  messagingSenderId: "363707047443",
  appId:             "1:363707047443:web:de9c941229ca070193e9e6"
};

// Initialise et exporte la DB
export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);