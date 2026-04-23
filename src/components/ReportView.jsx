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

      {/* קבוצות מסודרות */}
      {activeReport.groups && activeReport.groups.map(group => (
        <div key={group.id} style={reportGroupStyle}>
          <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px', fontSize: '20px' }}>
            {group.title || 'קבוצה ללא שם'}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* 1. הצגת המבנה החדש (רשימה מעורבת של פריטים) */}
            {group.items && group.items.length > 0 && group.items.map((item, idx) => {
              if (item.type === 'image') {
                return (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    <img src={item.url || item.localUrl} style={reportGroupImgStyle} alt="store item" />
                    {item.note && (
                      <p style={attachedNoteStyle}>
                        <strong>הערה:</strong> {item.note}
                      </p>
                    )}
                  </div>
                );
              } else if (item.type === 'note') {
                return <p key={item.id} style={noteItemStyle}>{item.text}</p>;
              }
              return null;
            })}

            {/* 2. תמיכה לאחור בדוחות ישנים (לפני העדכון) */}
            {(!group.items || group.items.length === 0) && (group.images?.length > 0 || group.notes?.length > 0) && (
              <>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {(group.images || []).map((img, idx) => (
                    <img key={`legacy_img_${idx}`} src={img} style={{...reportGroupImgStyle, width: '150px', height: '150px'}} alt="store group" />
                  ))}
                </div>
                {(group.notes || []).map((n, i) => (
                  <p key={`legacy_note_${i}`} style={noteItemStyle}>{n}</p>
                ))}
              </>
            )}

            {/* הודעה לקבוצה ריקה */}
            {(!group.items || group.items.length === 0) && (!group.images || group.images.length === 0) && (!group.notes || group.notes.length === 0) ? (
              <p style={{ color: '#95a5a6', fontStyle: 'italic' }}>אין פריטים בקבוצה זו</p>
            ) : null}

          </div>
        </div>
      ))}
    </div>
  );
}

const reportContainerStyle = { padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: '0 auto', backgroundColor: 'white', minHeight: '100vh' };
const reportHeaderStyle = { textAlign: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '20px', border: '1px solid #eee', borderRadius: '15px', marginBottom: '25px', backgroundColor: '#fcfcfc', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' };
const reportGroupImgStyle = { width: '100%', maxWidth: '400px', height: 'auto', borderRadius: '12px', objectFit: 'contain' };
const noteItemStyle = { padding: '15px', background: '#fff', borderRight: '5px solid #3498db', marginBottom: '10px', fontSize: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '8px' };
const attachedNoteStyle = { padding: '10px 15px', backgroundColor: '#f0f3f4', borderRight: '4px solid #f1c40f', borderRadius: '8px', fontSize: '15px', margin: 0, display: 'inline-block', maxWidth: '400px', color: '#2c3e50' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };