// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmJJsGNh-ZCX_1lWHm_x6pfO7zFG-PoyQ",
  authDomain: "jabu-analyzer.firebaseapp.com",
  projectId: "jabu-analyzer",
  storageBucket: "jabu-analyzer.firebasestorage.app",
  messagingSenderId: "1089457514026",
  appId: "1:1089457514026:web:358824bb318e8569898553",
  measurementId: "G-34T6S9CZDP"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
