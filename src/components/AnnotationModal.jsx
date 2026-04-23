import { useRef, useEffect, useState } from 'react';
import { X, Save, Loader } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

// ייבוא פונקציות השמירה והסנכרון המקומיות
import { saveImageOffline, syncOfflineImages } from '../offlineStorage';

export default function AnnotationModal({ 
  user, isOnline, pendingPhoto, setPendingPhoto, setIsAnnotating, 
  setIsUploading, activeReport, setActiveReport, targetGroupId 
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const ctxRef = useRef(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (pendingPhoto && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const MAX_WIDTH = 1000;
        let newWidth = img.width;
        let newHeight = img.height;
        if (newWidth > MAX_WIDTH) { newHeight = (newHeight * MAX_WIDTH) / newWidth; newWidth = MAX_WIDTH; }
        canvas.width = newWidth;
        canvas.height = newHeight;
        context.drawImage(img, 0, 0, newWidth, newHeight);
        context.strokeStyle = '#e74c3c';
        context.lineWidth = 6;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        ctxRef.current = context;
      };
      img.src = pendingPhoto;
    }
  }, [pendingPhoto]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => { e.preventDefault(); isDrawing.current = true; const { x, y } = getCoordinates(e); ctxRef.current.beginPath(); ctxRef.current.moveTo(x, y); };
  const draw = (e) => { e.preventDefault(); if (!isDrawing.current || !ctxRef.current) return; const { x, y } = getCoordinates(e); ctxRef.current.lineTo(x, y); ctxRef.current.stroke(); };
  const stopDrawing = () => { isDrawing.current = false; ctxRef.current?.beginPath(); };

  const handleUploadAnnotated = async () => {
    if (!targetGroupId) return alert("שגיאה: לא נבחרה קבוצת יעד לתמונה.");
    
    setIsProcessing(true);
    setIsUploading(true); 
    
    const canvas = canvasRef.current;
    
    canvas.toBlob(async (blob) => {
      try {
        let finalUrl = '';

        if (isOnline) {
          const filename = `tour_${user.uid}_${Date.now()}.jpg`;
          const storageRef = ref(storage, `images/${filename}`);
          await uploadBytes(storageRef, blob);
          finalUrl = await getDownloadURL(storageRef);
        } else {
          finalUrl = URL.createObjectURL(blob);
          await saveImageOffline(activeReport.id, targetGroupId, blob, finalUrl);
        }

        // עדכון הקבוצה הקיימת בתוך מערך ה-items המאוחד
        let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
        const gIndex = newGroups.findIndex(g => g.id === targetGroupId);
        
        if (gIndex > -1) {
          const newImageItem = { 
            id: `img_${Date.now()}`, 
            type: 'image', 
            url: finalUrl, 
            note: '' 
          };
          
          if (!newGroups[gIndex].items) newGroups[gIndex].items = [];
          newGroups[gIndex].items.push(newImageItem);
          
          const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
          setActiveReport(updatedReport);
          
          await updateDoc(doc(db, "reports", activeReport.id), { 
            groups: newGroups, 
            updatedAt: updatedReport.updatedAt 
          });
        }

      } catch (error) { 
        alert("שגיאה בעיבוד התמונה."); 
      } finally { 
        setIsProcessing(false);
        setIsUploading(false); 
        setIsAnnotating(false); 
        setPendingPhoto(null); 
        
        // הפעלת סנכרון רקע אם יש אינטרנט
        syncOfflineImages(user, activeReport, setActiveReport).catch(e => console.error(e));
      }
    }, 'image/jpeg', 0.7); 
  };

  return (
    <div style={annotationModalStyle} dir="rtl">
      <div style={annotationHeaderStyle}>
        <button onClick={() => {setIsAnnotating(false); setPendingPhoto(null);}} style={cancelBtnStyle} disabled={isProcessing}>
          <X size={20} /> ביטול
        </button>
        <span style={{color: 'white', fontWeight: 'bold'}}>סימון על תמונה</span>
        <button onClick={handleUploadAnnotated} style={saveAnnotateBtnStyle} disabled={isProcessing}>
          {isProcessing ? <Loader className="spin" size={20} /> : <Save size={20} />}
          {isProcessing ? 'מעבד...' : 'שמור לקבוצה'}
        </button>
      </div>
      <div style={canvasContainerStyle}>
        <canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={canvasStyle} />
      </div>
      <p style={{color: '#bdc3c7', textAlign: 'center', marginTop: '15px', fontSize: '14px'}}>השתמש באצבע לסימון • התמונה תישמר ישירות לקבוצה הנבחרת</p>
    </div>
  );
}

const annotationModalStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#1e272e', zIndex: 9999, display: 'flex', flexDirection: 'column' };
const annotationHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#2c3e50' };
const cancelBtnStyle = { background: 'none', border: 'none', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const saveAnnotateBtnStyle = { background: '#2ecc71', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 'bold', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' };
const canvasContainerStyle = { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', overflow: 'hidden' };
const canvasStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'none', border: '2px solid #34495e', borderRadius: '8px', backgroundColor: '#000' };