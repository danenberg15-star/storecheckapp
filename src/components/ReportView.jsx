import { ArrowRight } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  if (!activeReport) return null;

  // פונקציה המחשבת את פריסת הגריד עבור התמונות (עבור תצוגת אינטרנט ו-PDF)
  const getImageGridStyle = (count) => {
    if (count === 0) return {};
    if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    if (count === 3 || count === 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    if (count <= 6) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
    if (count <= 9) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr' };
    return { gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' };
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = activeReport.title || 'StoreCheck_Report';
    window.print();
    document.title = originalTitle;
  };

  const exportToDoc = () => {
    let groupsHtml = '';

    activeReport.groups.forEach((group) => {
      const items = group.items || [];
      const legacyImages = group.images?.map(url => ({ type: 'image', url })) || [];
      const legacyNotes = group.notes?.map(text => ({ type: 'note', text })) || [];
      const allItems = items.length > 0 ? items : [...legacyImages, ...legacyNotes];

      const notes = allItems.filter(item => item.type === 'note');
      const images = allItems.filter(item => item.type === 'image');

      let groupHtml = `<div class="report-group-page">`;
      groupHtml += `<h2 class="group-title">${group.title || 'קבוצה ללא שם'}</h2>`;

      notes.forEach(note => {
        groupHtml += `<div class="note-item">${note.text}</div>`;
      });

      if (images.length > 0) {
        const cols = images.length === 1 ? 1 : (images.length <= 4 ? 2 : 3);
        groupHtml += `<table width="100%" cellspacing="2" cellpadding="0" style="table-layout: fixed;"><tr>`;
        
        images.forEach((img, idx) => {
          if (idx > 0 && idx % cols === 0) groupHtml += `</tr><tr>`;
          groupHtml += `
            <td valign="top" style="border: 1px solid #eee; padding: 5px; text-align: center;">
              <img src="${img.url || img.localUrl}" style="width: 100%; height: auto;" />
              ${img.note ? `<div class="image-note"><strong>הערה:</strong> ${img.note}</div>` : ''}
            </td>`;
        });
        
        const remaining = (cols - (images.length % cols)) % cols;
        for(let i=0; i<remaining; i++) groupHtml += `<td></td>`;
        
        groupHtml += `</tr></table>`;
      }

      groupHtml += `</div><br style="page-break-after: always; clear: both;">`;
      groupsHtml += groupHtml;
    });

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${activeReport.title}</title>
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; margin: 0; padding: 0; }
        .report-group-page { border: 2px solid #2c3e50; padding: 20px; margin-bottom: 20px; width: 100%; }
        .group-title { font-size: 22pt; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
        .note-item { padding: 12px; border-right: 6px solid #3498db; background: #f4f7f9; margin-bottom: 10px; font-size: 14pt; }
        .image-note { color: #2c3e50; background: #f1c40f22; border-right: 3px solid #f1c40f; padding: 5px; font-size: 11pt; margin-top: 5px; text-align: right; }
      </style>
      </head><body>
      <div style="border: 2px solid #2c3e50; padding: 50px; text-align: center; margin-bottom: 50px;">
        <h1 style="font-size: 36pt;">${activeReport.title}</h1>
        <p style="font-size: 18pt; color: #7f8c8d;">${new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
      </div>
      <br style="page-break-after: always;">
    `;
    
    const footer = "</body></html>";
    const sourceHTML = header + groupsHtml + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeReport.title || 'StoreCheck_Report'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={reportContainerStyle} dir="rtl">
      
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }

          .report-group-page {
            height: 96vh !important; 
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            margin: 0 !important;
            padding: 20px !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            background: white !important;
            border: 2px solid #2c3e50 !important;
          }

          /* דף השער משתמש באותו מבנה של קבוצה כדי למנוע כפל דפים */
          .report-header-as-group {
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;
          }
        }
      `}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => setView('tour')} style={backBtnStyle}>
          <ArrowRight size={20} /> חזרה
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToDoc} style={docsBtnStyle}>
            ייצא ל-Docs
          </button>
          <button onClick={handlePrint} style={printBtnStyle}>
            שמור PDF
          </button>
        </div>
      </div>
      
      <div id="printable-report-content">
        {/* דף שער - מוגדר עכשיו כקבוצה לכל דבר ועניין */}
        <div style={{ ...reportGroupStyle, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }} className="report-group-page report-header-as-group">
          <h1 style={{ fontSize: '42px', color: '#2c3e50', marginBottom: '10px' }}>{activeReport.title}</h1>
          <p style={{ fontSize: '22px', color: '#7f8c8d' }}>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
        </div>

        {/* דפי קבוצות */}
        {activeReport.groups && activeReport.groups.map(group => {
          const items = group.items || [];
          const legacyImages = group.images?.map(url => ({ type: 'image', url })) || [];
          const legacyNotes = group.notes?.map(text => ({ type: 'note', text })) || [];
          const allItems = items.length > 0 ? items : [...legacyImages, ...legacyNotes];

          const notes = allItems.filter(item => item.type === 'note');
          const images = allItems.filter(item => item.type === 'image');

          return (
            <div key={group.id} className="report-group-page" style={reportGroupStyle}>
              <h3 style={groupHeaderStyle} className="group-title">
                {group.title || 'קבוצה ללא שם'}
              </h3>
              
              {notes.length > 0 && (
                <div style={notesContainerStyle}>
                  {notes.map((note, idx) => (
                    <div key={note.id || idx} style={noteItemStyle} className="note-item">
                      {note.text}
                    </div>
                  ))}
                </div>
              )}

              {images.length > 0 && (
                <div style={{ 
                  ...imageGridContainerStyle, 
                  ...getImageGridStyle(images.length) 
                }}>
                  {images.map((img, idx) => (
                    <div key={img.id || idx} style={imageWrapperStyle}>
                      <img src={img.url || img.localUrl} style={imageStyle} alt="store" />
                      {img.note && (
                        <div style={attachedNoteOverlayStyle} className="image-note">
                          <strong>הערה:</strong> {img.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {allItems.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#95a5a6', fontStyle: 'italic' }}>אין פריטים בקבוצה זו</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Styles (UI)
const reportContainerStyle = { padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: '0 auto', backgroundColor: '#f0f2f5', minHeight: '100vh' };
const reportHeaderStyle = { textAlign: 'center', padding: '40px 20px', marginBottom: '30px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '20px', borderRadius: '15px', marginBottom: '30px', backgroundColor: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', boxSizing: 'border-box', border: '2px solid #2c3e50', minHeight: '300px' };
const groupHeaderStyle = { marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '10px', fontSize: '24px', flexShrink: 0 };
const notesContainerStyle = { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', flexShrink: 0 };
const noteItemStyle = { padding: '10px 15px', background: '#fff', borderRight: '5px solid #3498db', fontSize: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderRadius: '4px', width: '100%', boxSizing: 'border-box' };
const imageGridContainerStyle = { display: 'grid', gap: '2px', flex: 1, minHeight: 0 };
const imageWrapperStyle = { position: 'relative', height: '100%', width: '100%', minHeight: 0, backgroundColor: '#fdfdfd', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const imageStyle = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };
const attachedNoteOverlayStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 10px', backgroundColor: 'rgba(255, 255, 255, 0.85)', borderTop: '2px solid #f1c40f', fontSize: '12px', color: '#2c3e50', maxHeight: '25%', overflow: 'hidden' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const docsBtnStyle = { padding: '10px 20px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };