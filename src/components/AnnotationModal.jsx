import { useRef, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

export default function AnnotationModal({ 
  user, isOnline, pendingPhoto, setPendingPhoto, setIsAnnotating, 
  setIsUploading, activeReport, setActiveReport 
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const ctxRef = useRef(null);

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
    setIsUploading(true); setIsAnnotating(false);
    const canvas = canvasRef.current;
    
    canvas.toBlob(async (blob) => {
      try {
        const filename = `tour_${user.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `images/${filename}`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        
        const newGroup = { id: `group_${Date.now()}`, title: '', images: [url], notes: [] };
        const updatedGroups = [newGroup, ...(activeReport.groups || [])];
        const updatedReport = { ...activeReport, groups: updatedGroups, updatedAt: new Date().toISOString() };
        
        await updateDoc(doc(db, "reports", activeReport.id), { groups: updatedGroups, updatedAt: updatedReport.updatedAt });
        setActiveReport(updatedReport);
      } catch (error) { alert("שגיאה בהעלאת התמונה."); } 
      finally { setIsUploading(false); setPendingPhoto(null); }
    }, 'image/jpeg', 0.7); 
  };

  return (
    <div style={annotationModalStyle} dir="rtl">
      <div style={annotationHeaderStyle}>
        <button onClick={() => {setIsAnnotating(false); setPendingPhoto(null);}} style={cancelBtnStyle}><X size={20} /> ביטול</button>
        <span style={{color: 'white', fontWeight: 'bold'}}>סמן על התמונה</span>
        <button onClick={handleUploadAnnotated} style={saveAnnotateBtnStyle}><Save size={20} /> שמור</button>
      </div>
      <div style={canvasContainerStyle}>
        <canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={canvasStyle} />
      </div>
      <p style={{color: '#bdc3c7', textAlign: 'center', marginTop: '15px', fontSize: '14px'}}>העבר אצבע כדי לסמן (התמונה תכווץ אוטומטית)</p>
    </div>
  );
}

const annotationModalStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#1e272e', zIndex: 9999, display: 'flex', flexDirection: 'column' };
const annotationHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#2c3e50' };
const cancelBtnStyle = { background: 'none', border: 'none', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const saveAnnotateBtnStyle = { background: '#2ecc71', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 'bold', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' };
const canvasContainerStyle = { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', overflow: 'hidden' };
const canvasStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'none', border: '2px solid #34495e', borderRadius: '8px', backgroundColor: '#000' };