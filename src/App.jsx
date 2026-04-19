import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, FileText, Loader, Square, Wifi, WifiOff, LogOut, LogIn, ChevronRight, Download, Edit2, Check, Plus, Folder, ArrowRight } from 'lucide-react';
import { storage, db, auth, provider } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  // App Navigation States
  const [view, setView] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [newReportTitle, setNewReportTitle] = useState('');
  
  // Active Tour States
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  
  const fileInputRef = useRef(null);

  // Initialization & Auth
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

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save active state continuously
  useEffect(() => {
    if (activeReport && user) {
      localStorage.setItem(`saved_report_${user.uid}`, JSON.stringify(activeReport));
    }
  }, [activeReport, user]);

  const checkSavedState = async (uid) => {
    const saved = localStorage.getItem(`saved_report_${uid}`);
    if (saved) {
      const parsedReport = JSON.parse(saved);
      setActiveReport(parsedReport);
      setView('tour');
    }
  };

  const fetchReports = async (uid) => {
    try {
      const q = query(collection(db, "reports"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const loadedReports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loadedReports.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setReports(loadedReports);
    } catch (e) {
      console.error("Error fetching reports:", e);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleLogin = async () => {
    try { 
      // Changed BACK to Popup to prevent PWA standalone crash
      await signInWithPopup(auth, provider); 
    } 
    catch (error) { alert("Login Error: " + error.message); }
  };

  const handleLogout = () => {
    localStorage.removeItem(user ? `saved_report_${user.uid}` : '');
    signOut(auth);
  };

  const startNewReport = async () => {
    if (!newReportTitle.trim()) return alert("אנא הזן כותרת לסיור");
    
    const newReport = {
      title: newReportTitle,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
      images: []
    };

    try {
      const docRef = await addDoc(collection(db, "reports"), newReport);
      const reportWithId = { id: docRef.id, ...newReport };
      setActiveReport(reportWithId);
      setNewReportTitle('');
      setView('tour');
    } catch (error) {
      alert("Error creating report.");
    }
  };

  const resumeReport = (report) => {
    setActiveReport(report);
    setView('tour');
  };

  const closeTour = () => {
    localStorage.removeItem(`saved_report_${user.uid}`);
    setActiveReport(null);
    fetchReports(user.uid);
    setView('dashboard');
  };

  const handleCapture = async (event) => {
    const file = event.target.files[0];
    if (!file || !user || !activeReport) return;
    setIsUploading(true);
    try {
      const filename = `tour_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `images/${filename}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const updatedImages = [...activeReport.images, url];
      const updatedReport = { ...activeReport, images: updatedImages, updatedAt: new Date().toISOString() };
      
      await updateDoc(doc(db, "reports", activeReport.id), { images: updatedImages, updatedAt: updatedReport.updatedAt });
      setActiveReport(updatedReport);
    } catch (error) {
      alert("Upload failed.");
    } finally { 
      setIsUploading(false); 
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      const updatedNotes = [...activeReport.notes, text];
      const updatedReport = { ...activeReport, notes: updatedNotes, updatedAt: new Date().toISOString() };
      
      setActiveReport(updatedReport);
      
      if (isOnline) {
        try {
          await updateDoc(doc(db, "reports", activeReport.id), { notes: updatedNotes, updatedAt: updatedReport.updatedAt });
        } catch(e) { console.error(e); }
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const saveNoteEdit = async (index) => {
    const updatedNotes = [...activeReport.notes];
    updatedNotes[index] = editNoteText;
    const updatedReport = { ...activeReport, notes: updatedNotes, updatedAt: new Date().toISOString() };
    
    setActiveReport(updatedReport);
    setEditingNoteIndex(null);

    if (isOnline) {
      await updateDoc(doc(db, "reports", activeReport.id), { notes: updatedNotes, updatedAt: updatedReport.updatedAt });
    }
  };

  if (!user) {
    return (
      <div style={loginContainerStyle}>
        <div style={loginCardStyle}>
          <h1 style={{ marginBottom: '10px' }}>StoreCheck</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>אנא התחבר עם החשבון המורשה</p>
          <button style={loginBtnStyle} onClick={handleLogin}>
            <LogIn size={20} /> התחברות גוגל
          </button>
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
        <div style={{ marginTop: '20px' }}>
          <h3>תובנות:</h3>
          {activeReport.notes.map((n, i) => <p key={i} style={noteItemStyle}>{n}</p>)}
        </div>
        <div style={gridStyle}>
          {activeReport.images.map((u, i) => <img key={i} src={u} style={reportImgStyle} alt="store" />)}
        </div>
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
        <div style={{ display: 'flex', gap: '10px' }}>
          {deferredPrompt && (
            <button onClick={handleInstallClick} style={installBtnStyle}>
              <Download size={18} /> התקן
            </button>
          )}
          <button onClick={handleLogout} style={logoutBtnStyle}><LogOut size={20} /></button>
        </div>
      </div>

      {view === 'dashboard' && (
        <div>
          <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>הסיורים שלי</h2>
          
          <div style={newReportContainerStyle}>
            <input 
              value={newReportTitle} 
              onChange={(e) => setNewReportTitle(e.target.value)} 
              placeholder="שם חנות / כותרת סיור..." 
              style={inputStyle}
            />
            <button onClick={startNewReport} style={startBtnStyle}>
              <Plus size={20} /> התחל סיור
            </button>
          </div>

          <div style={{ marginTop: '30px' }}>
            {reports.length === 0 ? <p style={{ color: '#7f8c8d' }}>אין סיורים קודמים.</p> : null}
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

          <div style={summaryPreviewStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontWeight: 'bold', color: '#34495e' }}>הערות ({activeReport.notes.length})</span>
              <button onClick={() => setView('report')} style={genBtnStyle}><FileText size={14}/> דוח מלא</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeReport.notes.map((n, i) => (
                <div key={i} style={editableNoteStyle}>
                  {editingNoteIndex === i ? (
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                      <textarea 
                        value={editNoteText} 
                        onChange={(e) => setEditNoteText(e.target.value)} 
                        style={editInputStyle} 
                        rows={3}
                      />
                      <button onClick={() => saveNoteEdit(i)} style={saveEditBtnStyle}><Check size={20} /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <span style={{ flex: 1, fontSize: '15px', lineHeight: '1.4' }}>{n}</span>
                      <button 
                        onClick={() => { setEditingNoteIndex(i); setEditNoteText(n); }} 
                        style={editIconBtnStyle}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px' }}>
              {activeReport.images.map((url, i) => (
                <img key={i} src={url} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// STYLES (Kept identical for stability)
const loginContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' };
const loginCardStyle = { padding: '40px', backgroundColor: 'white', borderRadius: '25px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const loginBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const containerStyle = { padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'Arial', minHeight: '100vh', backgroundColor: '#f9fbfb' };
const statusBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingBottom: '15px', borderBottom: '1px solid #eee' };
const avatarStyle = { width: '35px', height: '35px', backgroundColor: '#3498db', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' };
const logoutBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer' };
const installBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px' };
const newReportContainerStyle = { display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const inputStyle = { padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' };
const startBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const reportCardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', border: '1px solid #eee' };
const actionGridStyle = { display: 'flex', gap: '15px', marginBottom: '30px' };
const btnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '20px', flex: 1, fontWeight: 'bold' };
const summaryPreviewStyle = { padding: '20px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' };
const editableNoteStyle = { padding: '12px', backgroundColor: '#f4f6f7', borderRadius: '10px', borderRight: '4px solid #3498db' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: '5px' };
const editInputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #bdc3c7', fontFamily: 'Arial', resize: 'vertical' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' };
const reportContainerStyle = { padding: '20px', maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', minHeight: '100vh' };
const reportHeaderStyle = { textAlign: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px' };
const noteItemStyle = { padding: '12px', background: '#f9f9f9', borderRight: '4px solid #3498db', marginBottom: '10px', fontSize: '15px' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' };
const reportImgStyle = { width: '100%', borderRadius: '10px' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' };

export default App;