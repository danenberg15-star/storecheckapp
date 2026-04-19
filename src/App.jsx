import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, FileText, Loader, Square, Wifi, WifiOff, LogOut, LogIn, ChevronRight, Download, Edit2, Check, Plus, Folder, ArrowRight, GripVertical } from 'lucide-react';
import { storage, db, auth, provider } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  const [view, setView] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [newReportTitle, setNewReportTitle] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // States for Editing and Dragging
  const [editingNote, setEditingNote] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null); // זיהוי האזור שמעליו מרחפים כרגע
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchReports(currentUser.uid);
        checkSavedState(currentUser.uid);
      }
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setDeferredPrompt(e); });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (activeReport && user) {
      localStorage.setItem(`saved_report_${user.uid}`, JSON.stringify(activeReport));
    }
  }, [activeReport, user]);

  const migrateOldReport = (report) => {
    let migrated = { ...report };
    if (!migrated.groups) {
      migrated.groups = (migrated.images || []).map(url => ({ id: url, imageUrl: url, notes: [] }));
      migrated.ungroupedNotes = migrated.notes || [];
    }
    return migrated;
  };

  const checkSavedState = async (uid) => {
    const saved = localStorage.getItem(`saved_report_${uid}`);
    if (saved) {
      setActiveReport(migrateOldReport(JSON.parse(saved)));
      setView('tour');
    }
  };

  const fetchReports = async (uid) => {
    try {
      const q = query(collection(db, "reports"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const loadedReports = querySnapshot.docs.map(doc => migrateOldReport({ id: doc.id, ...doc.data() }));
      loadedReports.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setReports(loadedReports);
    } catch (e) { console.error("Error fetching reports:", e); }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } catch (error) { alert("Login Error: " + error.message); }
  };

  const handleLogout = () => {
    localStorage.removeItem(user ? `saved_report_${user.uid}` : '');
    signOut(auth);
  };

  const startNewReport = async () => {
    if (!newReportTitle.trim()) return alert("אנא הזן כותרת לסיור");
    const newReport = {
      title: newReportTitle, userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      groups: [], ungroupedNotes: []
    };
    try {
      const docRef = await addDoc(collection(db, "reports"), newReport);
      setActiveReport({ id: docRef.id, ...newReport });
      setNewReportTitle('');
      setView('tour');
    } catch (error) { alert("Error creating report."); }
  };

  const resumeReport = (report) => { setActiveReport(report); setView('tour'); };
  const closeTour = () => { localStorage.removeItem(`saved_report_${user.uid}`); setActiveReport(null); fetchReports(user.uid); setView('dashboard'); };

  const handleCapture = async (event) => {
    const file = event.target.files[0];
    if (!file || !user || !activeReport) return;
    setIsUploading(true);
    try {
      const filename = `tour_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `images/${filename}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const newGroup = { id: `group_${Date.now()}`, imageUrl: url, notes: [] };
      const updatedGroups = [...(activeReport.groups || []), newGroup];
      const updatedReport = { ...activeReport, groups: updatedGroups, updatedAt: new Date().toISOString() };
      
      await updateDoc(doc(db, "reports", activeReport.id), { groups: updatedGroups, updatedAt: updatedReport.updatedAt });
      setActiveReport(updatedReport);
    } catch (error) { alert("Upload failed."); } 
    finally { setIsUploading(false); }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.onstart = () => setIsRecording(true);
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

  // --- Drag and Drop Logic ---
  const handleDragStart = (e, sourceGroupId, noteIndex) => {
    setDraggedItem({ sourceGroupId, noteIndex });
    if(e.dataTransfer) { e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; }
  };

  const handleDragOver = (e, targetGroupId) => {
    e.preventDefault(); // חובה כדי לאפשר שחרור
    if (dragOverGroupId !== targetGroupId) {
      setDragOverGroupId(targetGroupId); // צובע את המסגרת
    }
  };

  const handleDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleDrop = async (e, targetGroupId) => {
    e.preventDefault();
    setDragOverGroupId(null); // מנקה את הצבע של המסגרת
    if (!draggedItem) return;
    
    const { sourceGroupId, noteIndex } = draggedItem;
    if (sourceGroupId === targetGroupId) return; // לא עושה כלום אם נפל באותה קבוצה

    let newGroups = [...(activeReport.groups || [])];
    let newUngrouped = [...(activeReport.ungroupedNotes || [])];
    let noteText = '';

    // מחיקה ממקור ההעתקה
    if (sourceGroupId === 'ungrouped') {
      noteText = newUngrouped[noteIndex];
      newUngrouped.splice(noteIndex, 1);
    } else {
      const gIndex = newGroups.findIndex(g => g.id === sourceGroupId);
      noteText = newGroups[gIndex].notes[noteIndex];
      newGroups[gIndex].notes.splice(noteIndex, 1);
    }

    // הוספה ליעד החדש
    if (targetGroupId === 'ungrouped') {
      newUngrouped.push(noteText);
    } else {
      const gIndex = newGroups.findIndex(g => g.id === targetGroupId);
      newGroups[gIndex].notes.push(noteText);
    }

    const updatedReport = { ...activeReport, groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    setDraggedItem(null);

    if (isOnline) {
      await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: updatedReport.updatedAt });
    }
  };

  const saveNoteEdit = async () => {
    let newGroups = [...(activeReport.groups || [])];
    let newUngrouped = [...(activeReport.ungroupedNotes || [])];

    if (editingNote.groupId === 'ungrouped') {
      newUngrouped[editingNote.index] = editingNote.text;
    } else {
      const gIndex = newGroups.findIndex(g => g.id === editingNote.groupId);
      newGroups[gIndex].notes[editingNote.index] = editingNote.text;
    }

    const updatedReport = { ...activeReport, groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    setEditingNote(null);

    if (isOnline) {
      await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: updatedReport.updatedAt });
    }
  };

  const renderNote = (noteText, index, groupId) => {
    const isEditing = editingNote?.groupId === groupId && editingNote?.index === index;
    return (
      <div 
        key={index} 
        draggable 
        onDragStart={(e) => handleDragStart(e, groupId, index)}
        style={draggableNoteStyle}
      >
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

  // --- העיצובים החדשים לאזורי הקליטה (דינמיים לפי הריחוף) ---
  const getDropZoneStyle = (isHovered) => ({
    padding: '20px',
    backgroundColor: isHovered ? '#e8f4f8' : '#ecf0f1',
    borderRadius: '15px',
    marginBottom: '20px',
    border: isHovered ? '3px dashed #3498db' : '3px dashed #bdc3c7',
    minHeight: '120px',
    transition: 'all 0.2s ease',
    boxShadow: isHovered ? '0 0 15px rgba(52, 152, 219, 0.3)' : 'none'
  });

  const getGroupZoneStyle = (isHovered) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    padding: '20px',
    backgroundColor: isHovered ? '#ebf5fb' : 'white',
    borderRadius: '15px',
    marginBottom: '25px',
    boxShadow: isHovered ? '0 8px 25px rgba(52, 152, 219, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
    border: isHovered ? '3px dashed #3498db' : '3px solid transparent',
    transition: 'all 0.2s ease',
    minHeight: '180px' // אזור קליטה רחב יותר
  });

  if (!user) {
    return (
      <div style={loginContainerStyle}>
        <div style={loginCardStyle}>
          <h1 style={{ marginBottom: '10px' }}>StoreCheck</h1>
          <button style={loginBtnStyle} onClick={handleLogin}><LogIn size={20} /> התחברות גוגל</button>
        </div>
      </div>
    );
  }

  if (view === 'report') {
    return (
      <div style={reportContainerStyle} dir="rtl">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button onClick={() => setView('tour')} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
          <button onClick={() => window.print()} style={printBtnStyle}>שמור PDF</button>
        </div>
        <div style={reportHeaderStyle}>
          <h1>{activeReport.title}</h1>
          <p>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
        </div>
        
        {activeReport.ungroupedNotes && activeReport.ungroupedNotes.length > 0 && (
          <div style={reportGroupStyle}>
            <h3 style={{color: '#7f8c8d'}}>הערות כלליות:</h3>
            {activeReport.ungroupedNotes.map((n, i) => <p key={i} style={noteItemStyle}>{n}</p>)}
          </div>
        )}

        {activeReport.groups && activeReport.groups.map(group => (
          <div key={group.id} style={reportGroupStyle}>
            <img src={group.imageUrl} style={reportGroupImgStyle} alt="store" />
            <div style={{flex: 1}}>
              <h3 style={{marginTop: 0, color: '#2c3e50'}}>הערות לתמונה:</h3>
              {group.notes.length === 0 ? <p style={{color: '#95a5a6', fontStyle: 'italic'}}>אין הערות</p> : null}
              {group.notes.map((n, i) => <p key={i} style={noteItemStyle}>{n}</p>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={containerStyle} dir="rtl">
      <div style={statusBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={avatarStyle}>{user.displayName?.charAt(0)}</div>
          {isOnline ? <Wifi size={16} color="green" /> : <WifiOff size={16} color="red" />}
        </div>
        <button onClick={handleLogout} style={logoutBtnStyle}><LogOut size={20} /></button>
      </div>

      {view === 'dashboard' && (
        <div>
          <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>הסיורים שלי</h2>
          <div style={newReportContainerStyle}>
            <input value={newReportTitle} onChange={(e) => setNewReportTitle(e.target.value)} placeholder="שם חנות / כותרת סיור..." style={inputStyle} />
            <button onClick={startNewReport} style={startBtnStyle}><Plus size={20} /> התחל סיור</button>
          </div>
          <div style={{ marginTop: '30px' }}>
            {reports.map(r => (
              <div key={r.id} onClick={() => resumeReport(r)} style={reportCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <Folder color="#3498db" size={24} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{r.title}</div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>{new Date(r.updatedAt).toLocaleDateString('he-IL')}</div>
                  </div>
                </div>
                <ChevronRight color="#bdc3c7" />
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'tour' && activeReport && (
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
          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} style={{ display: 'none' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontWeight: 'bold', color: '#34495e', fontSize: '18px' }}>תיעוד וסיווג</span>
            <button onClick={() => setView('report')} style={genBtnStyle}><FileText size={14}/> דוח מלא</button>
          </div>

          {/* UNGROUPED NOTES ZONE */}
          <div 
            onDragOver={(e) => handleDragOver(e, 'ungrouped')} 
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'ungrouped')} 
            style={getDropZoneStyle(dragOverGroupId === 'ungrouped')}
          >
            <h3 style={{fontSize: '15px', color: '#34495e', margin: '0 0 15px 0'}}>הערות כלליות - גרור לכאן</h3>
            {(activeReport.ungroupedNotes || []).length === 0 ? 
              <p style={{color: '#bdc3c7', fontSize: '14px', fontStyle: 'italic'}}>אין הערות - הקלט עכשיו</p> : 
              (activeReport.ungroupedNotes || []).map((n, i) => renderNote(n, i, 'ungrouped'))
            }
          </div>

          {/* IMAGE GROUPS ZONE */}
          {(activeReport.groups || []).map((group, index) => (
            <div 
              key={group.id} 
              onDragOver={(e) => handleDragOver(e, group.id)} 
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.id)}
              style={getGroupZoneStyle(dragOverGroupId === group.id)}
            >
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
      )}
    </div>
  );
}

// STATIC STYLES
const loginContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' };
const loginCardStyle = { padding: '40px', backgroundColor: 'white', borderRadius: '25px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const loginBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const containerStyle = { padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'Arial', minHeight: '100vh', backgroundColor: '#f9fbfb' };
const statusBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' };
const avatarStyle = { width: '35px', height: '35px', backgroundColor: '#3498db', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' };
const logoutBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer' };
const newReportContainerStyle = { display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const inputStyle = { padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' };
const startBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const reportCardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', border: '1px solid #eee' };
const actionGridStyle = { display: 'flex', gap: '15px', marginBottom: '30px' };
const btnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '20px', flex: 1, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };

const draggableNoteStyle = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderRight: '5px solid #3498db', marginBottom: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: '5px' };
const editInputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #bdc3c7', fontFamily: 'Arial' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' };

const reportContainerStyle = { padding: '20px', maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', minHeight: '100vh' };
const reportHeaderStyle = { textAlign: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', border: '1px solid #eee', borderRadius: '15px', marginBottom: '25px', backgroundColor: '#fcfcfc', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' };
const reportGroupImgStyle = { width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px' };
const noteItemStyle = { padding: '15px', background: '#fff', borderRight: '5px solid #3498db', marginBottom: '10px', fontSize: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '8px' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px' };

export default App;