import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const DB_NAME = 'StoreCheckOffline';
const STORE_NAME = 'pendingImages';

function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImageOffline(reportId, groupId, blob, localUrl) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ reportId, groupId, blob, localUrl, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject();
  });
}

// עדכון פונקציית הסנכרון לתמיכה ב-Local First ועדכון UI חי
export async function syncOfflineImages(user, activeReport, setActiveReport) {
  if (!user || !navigator.onLine) return;
  
  const database = await getDB();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    
    req.onsuccess = async () => {
      const items = req.result;
      if (items.length === 0) return resolve();

      console.log(`מזהה ${items.length} תמונות לסנכרון... מתחיל העלאה ברקע.`);

      for (let item of items) {
        try {
          // 1. העלאה ל-Storage
          const filename = `tour_${user.uid}_${item.timestamp}.jpg`;
          const storageRef = ref(storage, `images/${filename}`);
          await uploadBytes(storageRef, item.blob);
          const url = await getDownloadURL(storageRef);

          // 2. עדכון Firestore
          const reportRef = doc(db, "reports", item.reportId);
          const snap = await getDoc(reportRef);
          
          if (snap.exists()) {
            const data = snap.data();
            let newGroups = JSON.parse(JSON.stringify(data.groups || []));
            const gIndex = newGroups.findIndex(g => g.id === item.groupId);
            
            if (gIndex > -1) {
              const imgIndex = newGroups[gIndex].images.indexOf(item.localUrl);
              if (imgIndex > -1) {
                newGroups[gIndex].images[imgIndex] = url;
                await updateDoc(reportRef, { groups: newGroups });
                
                // 3. עדכון ה-UI בזמן אמת (אם זה הדוח הפתוח כרגע)
                if (activeReport && activeReport.id === item.reportId && setActiveReport) {
                  setActiveReport(prev => {
                    if (!prev) return prev;
                    let updatedReport = JSON.parse(JSON.stringify(prev));
                    const liveGIndex = updatedReport.groups.findIndex(g => g.id === item.groupId);
                    if (liveGIndex > -1) {
                      const liveImgIndex = updatedReport.groups[liveGIndex].images.indexOf(item.localUrl);
                      if (liveImgIndex > -1) {
                        updatedReport.groups[liveGIndex].images[liveImgIndex] = url;
                      }
                    }
                    return updatedReport;
                  });
                }
              }
            }
          }
          
          // 4. ניקוי מהטלפון
          const delTx = database.transaction(STORE_NAME, 'readwrite');
          delTx.objectStore(STORE_NAME).delete(item.id);
          
          // שחרור כתובת הזיכרון הזמנית
          URL.revokeObjectURL(item.localUrl);
          
        } catch (e) { 
          console.error("שגיאה בסנכרון פריט", e); 
        }
      }
      resolve();
    };
  });
}