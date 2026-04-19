import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, FileText, Loader, Square, Edit2, Check, ArrowRight, GripVertical, X, Save } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

export default function ActiveTour({ user, isOnline, activeReport, setActiveReport, setView, closeTour }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  
  const [isAddingText, setIsAddingText] = useState(false);
  const [newTextNote, setNewTextNote] = useState('');
  
  // States for Image Annotation & Compression
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const ctxRef = useRef(null);
  
  const fileInputRef = useRef(null);

  // === Annotation & Compression Logic ===

  // 1. תופסים את התמונה מהמצלמה לפני העלאה
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // יוצרים קישור זמני לתמונה בתוך הזיכרון של הטלפון
    const objectUrl = URL.createObjectURL(file);
    setPendingPhoto(objectUrl);
    setIsAnnotating(true);
  };

  // 2. טוענים את התמונה לקנבס, מכווצים אותה, ומכינים אותה לציור
  useEffect(() => {
    if (isAnnotating && pendingPhoto && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // --- כיווץ התמונה למקסימום 1000 פיקסלים רוחב ---
        const MAX_WIDTH = 1000;
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (newWidth > MAX_WIDTH) {
          newHeight = (newHeight * MAX_WIDTH) / newWidth;
          newWidth = MAX_WIDTH;
        }
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // מציירים את התמונה המכווצת על הקנבס
        context.drawImage(img, 0, 0, newWidth, newHeight);
        
        // הגדרות העט (טוש אדום)
        context.strokeStyle = '#e74c3c';
        context.lineWidth = 6;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        ctxRef.current = context;
      };
      
      img.src = pendingPhoto;
    }
  }, [isAnnotating, pendingPhoto]);

  // 3. פונקציות ציור על המסך
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault(); // מונע גלילה של המסך בזמן שמציירים
    isDrawing.current = true;
    const { x, y } = getCoordinates(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing.current || !ctxRef.current) return;
    const { x, y } = getCoordinates(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    ctxRef.current?.beginPath();
  };

  // 4. שמירה, העלאה והוספה לדוח
  const handleUploadAnnotated = async () => {
    setIsUploading(true);
    setIsAnnotating(false); // סוגרים את חלון הציור
    
    const canvas = canvasRef.current;
    
    // הופכים את הקנבס לקובץ תמונה קטן (איכות 0.7 מקצצת 80% מהמשקל!)
    canvas.toBlob(async (blob) => {
      try {
        const filename = `tour_${user.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `images/${filename}`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        
        const newGroup = { id: `group_${Date.now()}`, imageUrl: url, notes: [] };
        const updatedGroups = [...(activeReport.groups || []), newGroup];
        const updatedReport = { ...activeReport, groups: updatedGroups, updatedAt: new Date().toISOString() };
        
        await updateDoc(doc(db, "reports", activeReport.id), { groups: updatedGroups, updatedAt: updatedReport.updatedAt });
        setActiveReport(updatedReport);
      } catch (error) {
        alert("שגיאה בהעלאת התמונה.");
      } finally {
        setIsUploading(false);
        setPendingPhoto(null);
      }
    }, 'image/jpeg', 0.7); 
  };


  // === Voice & Text Logic ===
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("הדפדפן שלך לא תומך בהקלטה. השתמש בטקסט חופשי.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.onstart = () => setIsRecording(true);
    recognition.onerror = (e) => { setIsRecording(false); console.error(e); };
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      const updatedUngrouped = [...(activeReport.ungroupedNotes || []), text];
      const updatedReport = { ...activeReport, ungroupedNotes: updatedUngrouped, updatedAt: new Date().toISOString() };
      
      setActiveReport(updatedReport);
      if (isOnline) {
        try { await updateDoc(doc(db, "reports", activeReport.id), { ungroupedNotes: updatedUngrouped, updatedAt: updatedReport.updatedAt }); } 
        catch(e) { console.error(e); }
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleAddTextNote = async () => {
    if (!newTextNote.trim()) { setIsAddingText(false); return; }
    const updatedUngrouped = [...(activeReport.ungroupedNotes || []), newTextNote.trim()];
    const updatedReport = { ...activeReport, ungroupedNotes: updatedUngrouped, updatedAt: new Date().toISOString() };
    
    setActiveReport(updatedReport);
    setNewTextNote('');
    setIsAddingText(false);

    if (isOnline) {
      try { await updateDoc(doc(db, "reports", activeReport.id), { ungroupedNotes: updatedUngrouped, updatedAt: updatedReport.updatedAt }); } 
      catch(e) { console.error(e); }
    }
  };

  // === Drag & Drop Logic ===
  const handleDragStart = (e, sourceGroupId, noteIndex) => {
    setDraggedItem({ sourceGroupId, noteIndex });
    if(e.dataTransfer) { e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; }
  };
  const handleDragOver = (e, targetGroupId) => { e.preventDefault(); if (dragOverGroupId !== targetGroupId) setDragOverGroupId(targetGroupId); };
  const handleDragLeave = () => setDragOverGroupId(null);
  
  const handleDrop = async (e, targetGroupId) => {
    e.preventDefault();
    setDragOverGroupId(null);
    if (!draggedItem) return;
    const { sourceGroupId, noteIndex } = draggedItem;
    if (sourceGroupId === targetGroupId) return;

    let newGroups = [...(activeReport.groups || [])];
    let newUngrouped = [...(activeReport.ungroupedNotes || [])];
    let noteText = '';

    if (sourceGroupId === 'ungrouped') {
      noteText = newUngrouped[noteIndex];
      newUngrouped.splice(noteIndex, 1);
    } else {
      const gIndex = newGroups.findIndex(g => g.id === sourceGroupId);
      noteText = newGroups[gIndex].notes[noteIndex];
      newGroups[gIndex].notes.splice(noteIndex, 1);
    }

    if (targetGroupId === 'ungrouped') newUngrouped.push(noteText);
    else {
      const gIndex = newGroups.findIndex(g => g.id === targetGroupId);
      newGroups[gIndex].notes.push(noteText);
    }

    const updatedReport = { ...activeReport, groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    setDraggedItem(null);

    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: updatedReport.updatedAt });
  };

  const saveNoteEdit = async () => {
    let newGroups = [...(activeReport.groups || [])];
    let newUngrouped = [...(activeReport.ungroupedNotes || [])];

    if (editingNote.groupId === 'ungrouped') newUngrouped[editingNote.index] = editingNote.text;
    else {
      const gIndex = newGroups.findIndex(g => g.id === editingNote.groupId);
      newGroups[gIndex].notes[editingNote.index] = editingNote.text;
    }

    const updatedReport = { ...activeReport, groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    setEditingNote(null);

    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: updatedReport.updatedAt });
  };

  const renderNote = (noteText, index, groupId) => {
    const isEditing = editingNote?.groupId === groupId && editingNote?.index === index;
    return (
      <div key={index} draggable onDragStart={(e) => handleDragStart(e, groupId, index)} style={draggableNoteStyle}>
        <GripVertical size={16} color="#bdc3c7" style={{cursor: 'grab'}} />
        {isEditing ? (
          <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
            <textarea value={editingNote.text} onChange={(e) => setEditingNote({...editingNote, text: e.target.value})} style={editInputStyle} rows={2} />
            <button onClick={saveNoteEdit} style={saveEditBtnStyle}><Check size={20} /></button>
          </div>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: '15px', lineHeight: '1.4' }}>{noteText}</span>
            <button onClick={() => setEditingNote({ groupId, index, text: noteText })} style={editIconBtnStyle}><Edit2 size={16} /></button>
          </>
        )}
      </div>
    );
  };

  const getDropZoneStyle = (isHovered) => ({ padding: '20px', backgroundColor: isHovered ? '#e8f4f8' : '#ecf0f1', borderRadius: '15px', marginBottom: '20px', border: isHovered ? '3px dashed #3498db' : '3px dashed #bdc3c7', minHeight: '120px', transition: 'all 0.2s ease', boxShadow: isHovered ? '0 0 15px rgba(52, 152, 219, 0.3)' : 'none' });
  const getGroupZoneStyle = (isHovered) => ({ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', backgroundColor: isHovered ? '#ebf5fb' : 'white', borderRadius: '15px', marginBottom: '25px', boxShadow: isHovered ? '0 8px 25px rgba(52, 152, 219, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)', border: isHovered ? '3px dashed #3498db' : '3px solid transparent', transition: 'all 0.2s ease', minHeight: '180px' });

  // === RENDER ===
  
  // אם אנחנו במצב ציור (Annotation Modal)
  if (isAnnotating) {
    return (
      <div style={annotationModalStyle} dir="rtl">
        <div style={annotationHeaderStyle}>
          <button onClick={() => setIsAnnotating(false)} style={cancelBtnStyle}><X size={20} /> ביטול</button>
          <span style={{color: 'white', fontWeight: 'bold'}}>סמן על התמונה</span>
          <button onClick={handleUploadAnnotated} style={saveAnnotateBtnStyle}><Save size={20} /> העלה</button>
        </div>
        
        <div style={canvasContainerStyle}>
          <canvas
            ref={canvasRef}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={canvasStyle}
          />
        </div>
        <p style={{color: '#bdc3c7', textAlign: 'center', marginTop: '15px', fontSize: '14px'}}>העבר אצבע כדי לסמן (התמונה תכווץ אוטומטית)</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={closeTour} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#2c3e50' }}>{activeReport.title}</h2>
      </div>

      <div style={actionGridStyle}>
        <button style={btnStyle} onClick={() => fileInputRef.current.click()} disabled={isUploading}>
          {isUploading ? <Loader className="spin" /> : <Camera size={30} />}
          <span>צילום</span>
        </button>
        <button style={{...btnStyle, backgroundColor: isRecording ? '#e74c3c' : '#2ecc71'}} onClick={startRecording}>
          {isRecording ? <Square size={30} /> : <Mic size={30} />}
          <span>הקלטה</span>
        </button>
      </div>
      
      {/* שינוי הפונקציה המופעלת בצילום תמונה */}
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <span style={{ fontWeight: 'bold', color: '#34495e', fontSize: '18px' }}>תיעוד וסיווג</span>
        <button onClick={() => setView('report')} style={genBtnStyle}><FileText size={14}/> דוח מלא</button>
      </div>

      <div onDragOver={(e) => handleDragOver(e, 'ungrouped')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'ungrouped')} style={getDropZoneStyle(dragOverGroupId === 'ungrouped')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{fontSize: '15px', color: '#34495e', margin: 0}}>הערות כלליות - גרור לכאן</h3>
          <button onClick={() => setIsAddingText(true)} style={addTextBtnStyle}><Edit2 size={14} /> טקסט חופשי</button>
        </div>

        {isAddingText && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input type="text" value={newTextNote} onChange={(e) => setNewTextNote(e.target.value)} placeholder="הקלד הערה כאן..." style={editInputStyle} autoFocus />
            <button onClick={handleAddTextNote} style={saveEditBtnStyle}><Check size={20} /></button>
          </div>
        )}

        {(activeReport.ungroupedNotes || []).length === 0 && !isAddingText ? 
          <p style={{color: '#bdc3c7', fontSize: '14px', fontStyle: 'italic'}}>אין הערות - הקלט או הקלד עכשיו</p> : 
          (activeReport.ungroupedNotes || []).map((n, i) => renderNote(n, i, 'ungrouped'))
        }
      </div>

      {(activeReport.groups || []).map((group, index) => (
        <div key={group.id} onDragOver={(e) => handleDragOver(e, group.id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, group.id)} style={getGroupZoneStyle(dragOverGroupId === group.id)}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
            <img src={group.imageUrl} style={{width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #eee'}} alt="group img" />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '16px' }}>תמונה {index + 1}</h3>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '13px' }}>הטל טקסט לתוך המסגרת כדי לשייך</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {group.notes.length === 0 ? 
              <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)', border: '1px dashed #bdc3c7', color: '#95a5a6', fontSize: '14px', textAlign: 'center' }}>
                אזור קליטה: גרור הערה לפה
              </div> : 
              group.notes.map((n, i) => renderNote(n, i, group.id))
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// Static Styles
const actionGridStyle = { display: 'flex', gap: '15px', marginBottom: '30px' };
const btnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '20px', flex: 1, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };
const draggableNoteStyle = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderRight: '5px solid #3498db', marginBottom: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: '5px' };
const editInputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #bdc3c7', fontFamily: 'Arial' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' };
const addTextBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#fff', color: '#2c3e50', border: '1px solid #bdc3c7', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

// Annotation Modal Styles
const annotationModalStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#1e272e', zIndex: 9999, display: 'flex', flexDirection: 'column' };
const annotationHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#2c3e50' };
const cancelBtnStyle = { background: 'none', border: 'none', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const saveAnnotateBtnStyle = { background: '#2ecc71', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 'bold', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' };
const canvasContainerStyle = { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', overflow: 'hidden' };
const canvasStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'none', border: '2px solid #34495e', borderRadius: '8px', backgroundColor: '#000' };