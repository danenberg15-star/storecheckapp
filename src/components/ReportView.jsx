import { ArrowRight } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  if (!activeReport) return null;

  return (
    <div style={reportContainerStyle} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => setView('tour')} style={backBtnStyle}>
          <ArrowRight size={20} /> חזרה
        </button>
        <button onClick={() => window.print()} style={printBtnStyle}>
          שמור PDF
        </button>
      </div>
      
      <div style={reportHeaderStyle}>
        <h1>{activeReport.title}</h1>
        <p>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
      </div>
      
      {/* הערות כלליות */}
      {activeReport.ungroupedNotes && activeReport.ungroupedNotes.length > 0 && (
        <div style={reportGroupStyle}>
          <h3 style={{ color: '#7f8c8d' }}>הערות כלליות:</h3>
          {activeReport.ungroupedNotes.map((n, i) => (
            <p key={i} style={noteItemStyle}>{n}</p>
          ))}
        </div>
      )}

      {/* קבוצות תמונות והערות */}
      {activeReport.groups && activeReport.groups.map(group => (
        <div key={group.id} style={reportGroupStyle}>
          <img src={group.imageUrl} style={reportGroupImgStyle} alt="store" />
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>הערות לתמונה:</h3>
            {group.notes.length === 0 ? (
              <p style={{ color: '#95a5a6', fontStyle: 'italic' }}>אין הערות</p>
            ) : null}
            {group.notes.map((n, i) => (
              <p key={i} style={noteItemStyle}>{n}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Styles for ReportView only
const reportContainerStyle = { padding: '20px', maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', minHeight: '100vh' };
const reportHeaderStyle = { textAlign: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', border: '1px solid #eee', borderRadius: '15px', marginBottom: '25px', backgroundColor: '#fcfcfc', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' };
const reportGroupImgStyle = { width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px' };
const noteItemStyle = { padding: '15px', background: '#fff', borderRight: '5px solid #3498db', marginBottom: '10px', fontSize: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '8px' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };