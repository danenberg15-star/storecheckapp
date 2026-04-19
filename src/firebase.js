import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// הגדרות ה-Firebase שלך
const firebaseConfig = {
  apiKey: "AIzaSyB2N4-RY26OgDHrJ-kHhMaxKYtHW83lsbY",
  authDomain: "storecheckapp.firebaseapp.com",
  projectId: "storecheckapp",
  storageBucket: "storecheckapp.firebasestorage.app",
  messagingSenderId: "1028489230720",
  appId: "1:1028489230720:web:0e910061523b09317fe965"
};

// אתחול האפליקציה ושירותי הנתונים
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);