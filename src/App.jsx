import { useState, useRef } from 'react';
import { Camera, Mic, FileText, Loader } from 'lucide-react';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function App() {
  const [images, setImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // הפונקציה שמטפלת בצילום והעלאה ל-Firebase
  const handleCapture = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. ניצור שם ייחודי לתמונה כדי שלא ידרסו אחת את השנייה
      const filename = `store_tour_${Date.now()}.jpg`;
      const storageRef = ref(storage, `images/${filename}`);

      // 2. נעלה את התמונה ל-Firebase
      await uploadBytes(storageRef, file);
      
      // 3. נקבל את הקישור הישיר לתמונה שהעלנו
      const downloadURL = await getDownloadURL(storageRef);
      
      // 4. נוסיף את התמונה החדשה לרשימת התמונות במסך
      setImages(prev => [...prev, downloadURL]);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("הייתה בעיה בהעלאת התמונה. נסה שוב.");
    } finally {
      // בסוף נכבה את מצב הטעינה
      setIsUploading(false);
    }
  };

  return (
    <div style={containerStyle} dir="rtl">
      <h1 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '30px' }}>
        ניהול סיור חנויות
      </h1>
      
      {/* זה ה"טריק" שלנו - שדה קובץ מוסתר שמכוון למצלמה של הטלפון */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef}
        onChange={handleCapture}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
        {/* כפתור המצלמה מפעיל בעצם את השדה המוסתר */}
        <button 
          style={btnStyle} 
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader size={32} /> : <Camera size={32} />}
          <span>{isUploading ? 'מעלה...' : 'צלם תמונה'}</span>
        </button>
        
        <button style={btnStyle} onClick={() => alert('הקלטה תופעל בשלב הבא')}>
          <Mic size={32} />
          <span>הקלט הערה</span>
        </button>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34495e' }}>
          <FileText size={24} />
          סיכום הסיור
        </h2>
        <div style={summaryBoxStyle}>
          {images.length === 0 ? (
            <p>התמונות וההקלטות שלך יופיעו כאן...</p>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' }}>
              {images.map((url, index) => (
                <img 
                  key={index} 
                  src={url} 
                  alt={`תמונה ${index + 1}`} 
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #eee' }} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// עיצוב
const containerStyle = {
  padding: '20px',
  maxWidth: '500px',
  margin: '0 auto',
  fontFamily: 'Arial, sans-serif',
  minHeight: '100vh',
  backgroundColor: '#f8f9fa'
};

const btnStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  padding: '20px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  flex: 1,
  fontSize: '16px',
  fontWeight: 'bold',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

const summaryBoxStyle = {
  padding: '20px',
  backgroundColor: 'white',
  border: '1px solid #dee2e6',
  borderRadius: '12px',
  minHeight: '200px',
  color: '#6c757d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};

export default App;