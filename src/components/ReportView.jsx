import { ArrowRight } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  if (!activeReport) return null;

  // גריד מודרני ל-PDF ולתצוגת רשת
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

  // ייצוא מותאם למנוע הרנדור של Word באמצעות טבלאות קשיחות
  const exportToDoc = () => {
    let groupsHtml = '';

    // 1. יצירת דף שער מוגן בתוך טבלה
    const coverHtml = `
      <table width="100%" style="border: 2px solid #2c3e50; margin-bottom: 50px;" cellpadding="50">
        <tr>
          <td align="center" valign="middle">
            <h1 style="font-size: 36pt; color: #2c3e50; margin-bottom: 10px; font-family: Arial, sans-serif;">${activeReport.title}</h1>
            <p style="font-size: 18pt; color: #7f8c8d; font-family: Arial, sans-serif;">${new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
          </td>
        </tr>
      </table>
      <br clear="all" style="page-break-before:always; mso-break-type:section-break;" />
    `;

    // 2. יצירת קבוצות (כל קבוצה מקבלת דף וטבלה משלה)
    activeReport.groups.forEach((group) => {
      const items = group.items || [];
      const legacyImages = group.images?.map(url => ({ type: 'image', url })) || [];
      const legacyNotes = group.notes?.map(text => ({ type: 'note', text })) || [];
      const allItems = items.length > 0 ? items : [...legacyImages, ...legacyNotes];

      const notes = allItems.filter(item => item.type === 'note');
      const images = allItems.filter(item => item.type === 'image');

      // התחלת טבלת המסגרת של הקבוצה
      let groupHtml = `
      <table width="100%" style="border: 2px solid #2c3e50; margin-bottom: 20px;" cellpadding="20">
        <tr>
          <td>
            <h2 style="font-size: 22pt; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 15px; margin-top: 0; font-family: Arial, sans-serif;">${group.title || 'קבוצה ללא שם'}</h2>
      `;

      // הערות בראש הקבוצה
      notes.forEach(note => {
        groupHtml += `<div style="padding: 12px; border-right: 6px solid #3498db; background: #f4f7f9; margin-bottom: 10px; font-size: 14pt; font-family: Arial, sans-serif;">${note.text}</div>`;
      });

      // טבלת תמונות פנימית כדי להכריח כיווץ מידות בוורד
      if (images.length > 0) {
        const cols = images.length === 1 ? 1 : (images.length <= 4 ? 2 : 3);
        const colWidth = Math.floor(100 / cols) + '%';
        
        groupHtml += `<table width="100%" cellspacing="5" cellpadding="0" style="table-layout: fixed; width: 100%;"><tr>`;
        
        images.forEach((img, idx) => {
          if (idx > 0 && idx % cols === 0) groupHtml += `</tr><tr>`;
          // תכונת width="100%" ישירות על תגית התמונה היא קריטית בוורד
          groupHtml += `
            <td valign="top" width="${colWidth}" style="border: 1px solid #eee; padding: 5px; text-align: center;">
              <img src="${img.url || img.localUrl}" width="100%" style="max-width: 100%; height: auto; display: block;" alt="store image" />
              ${img.note ? `<div style="color: #2c3e50; background: #f1c40f22; border-right: 3px solid #f1c40f; padding: 5px; font-size: 11pt; margin-top: 5px; text-align: right; font-family: Arial, sans-serif;"><strong>הערה:</strong> ${img.note}</div>` : ''}
            </td>`;
        });
        
        const remaining = (cols - (images.length % cols)) % cols;
        for(let i=0; i<remaining; i++) groupHtml += `<td width="${colWidth}"></td>`;
        
        groupHtml += `</tr></table>`;
      } else if (notes.length === 0) {
        groupHtml += `<div style="text-align: center; color: #95a5a6; font-style: italic; font-size: 14pt; font-family: Arial, sans-serif;">אין פריטים בקבוצה זו</div>`;
      }

      // סגירת טבלת הקבוצה ומעבר דף מחמיר
      groupHtml += `</td></tr></table><br clear="all" style="page-break-before:always; mso-break-type:section-break;" />`;
      groupsHtml += groupHtml;
    });

    const header = `
      <html xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset='utf-8'>
      <title>${activeReport.title}</title>
      <style>
        @page { size: 21cm 29.7cm; margin: 2cm; mso-page-orientation: portrait; }
        body { font-family: Arial, sans-serif; direction: rtl; margin: 0; padding: 0; }
      </style>
      </head><body>
    `;
    
    const footer = "</body></html>";
    const sourceHTML = header + coverHtml + groupsHtml + footer;
    
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
        {/* דף שער ל-PDF והתצוגה (מבוסס CSS מודרני) */}
        <div style={{ ...reportGroupStyle, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }} className="report-group-page report-header-as-group">
          <h1 style={{ fontSize: '42px', color: '#2c3e50', marginBottom: '10px' }}>{activeReport.title}</h1>
          <p style={{ fontSize: '22px', color: '#7f8c8d' }}>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
        </div>

        {/* קבוצות ל-PDF והתצוגה (מבוסס CSS מודרני) */}
        {activeReport.groups && activeReport.groups.map(group => {
          const items = group.items || [];
          const legacyImages = group.images?.map(url => ({ type: 'image', url })) || [];
          const legacyNotes = group.notes?.map(text => ({ type: 'note', text })) || [];
          const allItems = items.length > 0 ? items : [...legacyImages, ...legacyNotes];

          const notes = allItems.filter(item => item.type === 'note');
          const images = allItems.filter(item => item.type === 'image');

          return (
            <div key={group.id} className="report-group-page" style={reportGroupStyle}>
              <h3 style={groupHeaderStyle}>
                {group.title || 'קבוצה ללא שם'}
              </h3>
              
              {notes.length > 0 && (
                <div style={notesContainerStyle}>
                  {notes.map((note, idx) => (
                    <div key={note.id || idx} style={noteItemStyle}>
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
                        <div style={attachedNoteOverlayStyle}>
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