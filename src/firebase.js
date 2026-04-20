import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2N4-RY26OgDHrJ-kHhMaxKYtHW83lsbY",
  authDomain: "storecheckapp.firebaseapp.com",
  projectId: "storecheckapp",
  storageBucket: "storecheckapp.firebasestorage.app",
  messagingSenderId: "1028489230720",
  appId: "1:1028489230720:web:0e910061523b09317fe965"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// הפעלת שמירה מקומית לאופליין (עבור טקסטים, קבוצות ומבנה הדוח)
enableIndexedDbPersistence(db).catch((err) => {
  console.error("Offline persistence error:", err.code);
});

export const storage = getStorage(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();