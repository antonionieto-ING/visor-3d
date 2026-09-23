import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBkKjKgPuppCWVKu5iVAdxdOZuAZWh6q5E",
  authDomain: "visor-3d-d65a6.firebaseapp.com",
  projectId: "visor-3d-d65a6",
  storageBucket: "visor-3d-d65a6.firebasestorage.app",
  messagingSenderId: "140473012049",
  appId: "1:140473012049:web:c564ff979e6c3d8a06cd70"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
