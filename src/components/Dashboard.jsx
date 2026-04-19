import { Plus, Folder, ChevronRight } from 'lucide-react';

export default function Dashboard({ reports, resumeReport, startNewReport, newReportTitle, setNewReportTitle }) {
  return (
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
  );
}

// Styles for Dashboard only
const newReportContainerStyle = { display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const inputStyle = { padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' };
const startBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const reportCardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', border: '1px solid #eee' };