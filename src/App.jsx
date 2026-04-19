import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, FileText, Loader, Square, Wifi, WifiOff, LogOut, LogIn, ChevronRight, Download } from 'lucide-react';
import { storage, db, auth, provider } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [images, setImages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReport, setShowReport] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Check for redirect result on load
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect Result Error:", error.message);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleLogin = async () => {
    try {
      // Changed to Redirect for better mobile support
      await signInWithRedirect(auth, provider);
    } catch (error) {
      alert("Login Error: " + error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleCapture = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const filename = `tour_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `images/${filename}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImages(prev => [...prev, url]);
    } catch (error) {
      alert("Upload failed. Make sure you are the authorized user.");
    } finally { setIsUploading(false); }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setNotes(prev => [...prev, text]);
      if (isOnline && user) {
        await addDoc(collection(db, "tour_notes"), { 
          text, 
          timestamp: new Date().toISOString(),
          userId: user.uid 
        });
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  if (!user) {
    return (
      <div style={loginContainerStyle}>
        <div style={loginCardStyle}>
          <h1 style={{ marginBottom: '10px' }}>StoreCheck</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>Please login with authorized account</p>
          <button style={loginBtnStyle} onClick={handleLogin}>
            <LogIn size={20} /> Login with Google
          </button>
        </div>
      </div>
    );
  }

  if (showReport) {
    return (
      <div style={reportContainerStyle} dir="rtl">
        <button onClick={() => setShowReport(false)} style={backBtnStyle}><ChevronRight size={20} /> Back</button>
        <h1 style={{ textAlign: 'center' }}>Tour Summary</h1>
        <div style={{ marginTop: '20px' }}>
          {notes.map((n, i) => <p key={i} style={noteItemStyle}>{n}</p>)}
        </div>
        <div style={gridStyle}>
          {images.map((u, i) => <img key={i} src={u} style={reportImgStyle} alt="store" />)}
        </div>
        <button onClick={() => window.print()} style={printBtnStyle}>Save Report</button>
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
              <Download size={18} /> Install
            </button>
          )}
          <button onClick={handleLogout} style={logoutBtnStyle}><LogOut size={20} /></button>
        </div>
      </div>

      <div style={actionGridStyle}>
        <button style={btnStyle} onClick={() => fileInputRef.current.click()} disabled={isUploading}>
          {isUploading ? <Loader className="spin" /> : <Camera size={30} />}
          <span>Photo</span>
        </button>
        <button style={{...btnStyle, backgroundColor: isRecording ? '#e74c3c' : '#2ecc71'}} onClick={startRecording}>
          {isRecording ? <Square size={30} /> : <Mic size={30} />}
          <span>Record</span>
        </button>
      </div>

      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} style={{ display: 'none' }} />

      <div style={summaryPreviewStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{notes.length} notes</span>
          {notes.length > 0 && <button onClick={() => setShowReport(true)} style={genBtnStyle}>Report</button>}
        </div>
        {notes.slice(-1).map((n, i) => <p key={i} style={{ fontSize: '14px', marginTop: '10px' }}>{n}</p>)}
      </div>
    </div>
  );
}

const loginContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' };
const loginCardStyle = { padding: '40px', backgroundColor: 'white', borderRadius: '25px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const loginBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const containerStyle = { padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'Arial', minHeight: '100vh' };
const statusBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const avatarStyle = { width: '35px', height: '35px', backgroundColor: '#3498db', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' };
const logoutBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer' };
const installBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px' };
const actionGridStyle = { display: 'flex', gap: '15px', marginBottom: '30px' };
const btnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '20px', flex: 1, fontWeight: 'bold' };
const summaryPreviewStyle = { padding: '20px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };
const genBtnStyle = { padding: '5px 12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px' };
const reportContainerStyle = { padding: '20px', maxWidth: '800px', margin: '0 auto' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const noteItemStyle = { padding: '10px', background: '#f9f9f9', borderRight: '4px solid #3498db', marginBottom: '10px' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' };
const reportImgStyle = { width: '100%', borderRadius: '10px' };
const printBtnStyle = { width: '100%', padding: '15px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '12px', marginTop: '30px', fontWeight: 'bold' };

export default App;