import { useState, useEffect } from 'react';
import { Wifi, WifiOff, LogOut, Download } from 'lucide-react';
import { db, auth, provider } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ActiveTour from './components/ActiveTour';
import ReportView from './components/ReportView';

export default function App() {
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  const [view, setView] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [newReportTitle, setNewReportTitle] = useState('');

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
      migrated.groups = (migrated.images || []).map((url, i) => ({ id: `group_${i}_${Date.now()}`, title: '', images: [url], notes: [] }));
      migrated.ungroupedNotes = migrated.notes || [];
      migrated.ungroupedImages = [];
    } else {
      migrated.groups = migrated.groups.map(g => ({
        ...g,
        title: g.title || '',
        images: g.images || (g.imageUrl ? [g.imageUrl] : []),
        notes: g.notes || []
      }));
    }
    if (!migrated.ungroupedImages) migrated.ungroupedImages = [];
    if (!migrated.ungroupedNotes) migrated.ungroupedNotes = [];
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

  const deleteReport = async (reportId) => {
    if (!window.confirm("האם למחוק סיור זה לצמיתות?")) return;
    try {
      await deleteDoc(doc(db, "reports", reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      alert("שגיאה במחיקת הסיור.");
    }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("Login Error: " + error.message); }
  };

  const handleLogout = () => {
    localStorage.removeItem(user ? `saved_report_${user.uid}` : '');
    signOut(auth);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const startNewReport = async () => {
    if (!newReportTitle.trim()) return alert("אנא הזן כותרת לסיור");
    const newReport = {
      title: newReportTitle, userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      groups: [], ungroupedNotes: [], ungroupedImages: []
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

  if (!user) return <Login handleLogin={handleLogin} />;
  if (view === 'report') return <ReportView activeReport={activeReport} setView={setView} />;

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
        <Dashboard 
          reports={reports} 
          resumeReport={resumeReport} 
          startNewReport={startNewReport} 
          newReportTitle={newReportTitle} 
          setNewReportTitle={setNewReportTitle} 
          deleteReport={deleteReport}
        />
      )}

      {view === 'tour' && activeReport && (
        <ActiveTour 
          user={user} 
          isOnline={isOnline} 
          activeReport={activeReport} 
          setActiveReport={setActiveReport} 
          setView={setView} 
          closeTour={closeTour} 
        />
      )}
    </div>
  );
}

const containerStyle = { padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'Arial', minHeight: '100vh', backgroundColor: '#f9fbfb' };
const statusBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' };
const avatarStyle = { width: '35px', height: '35px', backgroundColor: '#3498db', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' };
const logoutBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer' };
const installBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px' };