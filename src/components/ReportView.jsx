import { ArrowRight } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  if (!activeReport) return null;

  // פונקציה חכמה שמחשבת את הפריסה בהתאם לכמות התמונות/טקסטים
  const getGridStyle = (count) => {
    if (count <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (count === 2) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' };
    if (count <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    if (count <= 6) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    if (count <= 9) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
    if (count <= 12) return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
    return { gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' };
  };

  return (
    <div style={reportContainerStyle} dir="rtl">
      
      {/* הגדרות קשיחות להדפסה וליצירת PDF מושלם */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          
          /* דף שער */
          .report-header-page {
            height: 98vh !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
          }

          /* כל קבוצה היא דף אחד */
          .report-group-page {
            height: 98vh !important; 
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            margin-bottom: 0 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => setView('tour')} style={backBtnStyle}>
          <ArrowRight size={20} /> חזרה
        </button>
        <button onClick={() => window.print()} style={printBtnStyle}>
          שמור PDF
        </button>
      </div>
      
      {/* דף השער של הדוח */}
      <div style={reportHeaderStyle} className="report-header-page">
        <h1 style={{ fontSize: '40px', color: '#2c3e50', marginBottom: '10px' }}>{activeReport.title}</h1>
        <p style={{ fontSize: '20px', color: '#7f8c8d' }}>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
      </div>

      {/* קבוצות מסודרות - חלוקה לדפים */}
      {activeReport.groups && activeReport.groups.map(group => {
        // ספירת סך הכל הפריטים בקבוצה כדי לדעת איך לחלק את הרשת
        const itemCount = (group.items || []).length || (group.images?.length || 0) + (group.notes?.length || 0);
        
        return (
          <div key={group.id} className="report-group-page" style={reportGroupStyle}>
            <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px', fontSize: '24px', flexShrink: 0 }}>
              {group.title || 'קבוצה ללא שם'}
            </h3>
            
            {/* הרשת הדינמית שתופסת את כל המקום שנשאר בדף */}
            <div style={{ display: 'grid', gap: '15px', flex: 1, minHeight: 0, ...getGridStyle(itemCount) }}>
              
              {/* 1. הצגת המבנה המאוחד (Unified Items) */}
              {group.items && group.items.length > 0 && group.items.map((item, idx) => {
                if (item.type === 'image') {
                  return (
                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '8px', backgroundColor: '#fff', padding: '10px', borderRadius: '12px', border: '1px solid #eee', boxSizing: 'border-box' }}>
                      <img src={item.url || item.localUrl} style={{ width: '100%', height: '100%', flex: 1, objectFit: 'contain', minHeight: 0, borderRadius: '8px' }} alt="store item" />
                      {item.note && (
                        <p style={{ ...attachedNoteStyle, flexShrink: 0, width: '100%', boxSizing: 'border-box' }}>
                          <strong>הערה:</strong> {item.note}
                        </p>
                      )}
                    </div>
                  );
                } else if (item.type === 'note') {
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '15px', background: '#fff', borderRight: '5px solid #3498db', fontSize: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '8px', boxSizing: 'border-box' }}>
                      <p style={{ margin: 0, textAlign: 'center', width: '100%', overflowWrap: 'break-word' }}>{item.text}</p>
                    </div>
                  );
                }
                return null;
              })}

              {/* 2. תמיכה לאחור בדוחות ישנים (לפני העדכון) */}
              {(!group.items || group.items.length === 0) && (group.images?.length > 0 || group.notes?.length > 0) && (
                <>
                  {(group.images || []).map((img, idx) => (
                    <div key={`legacy_img_${idx}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, backgroundColor: '#fff', padding: '10px', borderRadius: '12px', border: '1px solid #eee', boxSizing: 'border-box' }}>
                      <img src={img} style={{ width: '100%', height: '100%', flex: 1, objectFit: 'contain', minHeight: 0, borderRadius: '8px' }} alt="store group" />
                    </div>
                  ))}
                  {(group.notes || []).map((n, i) => (
                    <div key={`legacy_note_${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '15px', background: '#fff', borderRight: '5px solid #3498db', fontSize: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '8px', boxSizing: 'border-box' }}>
                      <p style={{ margin: 0, textAlign: 'center', width: '100%', overflowWrap: 'break-word' }}>{n}</p>
                    </div>
                  ))}
                </>
              )}

              {/* הודעה לקבוצה ריקה */}
              {(!group.items || group.items.length === 0) && (!group.images || group.images.length === 0) && (!group.notes || group.notes.length === 0) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1' }}>
                  <p style={{ color: '#95a5a6', fontStyle: 'italic', fontSize: '18px' }}>אין פריטים בקבוצה זו</p>
                </div>
              ) : null}

            </div>
          </div>
        );
      })}
    </div>
  );
}

// Styles
const reportContainerStyle = { padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: '0 auto', backgroundColor: '#f0f2f5', minHeight: '100vh' };
const reportHeaderStyle = { textAlign: 'center', padding: '40px 20px', marginBottom: '30px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '25px', borderRadius: '15px', marginBottom: '30px', backgroundColor: '#fcfcfc', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', boxSizing: 'border-box' };
const attachedNoteStyle = { padding: '10px 15px', backgroundColor: '#f0f3f4', borderRight: '4px solid #f1c40f', borderRadius: '8px', fontSize: '15px', margin: 0, display: 'inline-block', color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };