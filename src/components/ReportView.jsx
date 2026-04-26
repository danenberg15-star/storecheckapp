import { ArrowRight } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  if (!activeReport) return null;

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
    
    const coverHtml = `
      <table width="510" height="720" align="center" style="border: 8px double #1a365d; background-color: #f0f7ff; margin-bottom: 0;" cellpadding="40">
        <tr height="720">
          <td align="center" valign="middle" height="720">
            <div style="font-size: 14pt; color: #3498db; font-weight: bold; font-family: Arial;">DIPLOMAT GROUP</div>
            <h1 style="font-size: 38pt; color: #1a365d; margin: 15pt 0; font-family: Arial;">${activeReport.title}</h1>
            <div style="width: 120pt; border-top: 4pt solid #3498db; margin: 20pt auto;"></div>
            <p style="font-size: 20pt; color: #2c3e50; font-weight: bold; font-family: Arial;">דוח סיור חנות ומדדי ביצוע</p>
            <p style="font-size: 14pt; color: #7f8c8d; margin-top: 30pt; font-family: Arial;">הופק בתאריך: ${new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
          </td>
        </tr>
      </table>
      <br clear="all" style="page-break-before:always; mso-break-type:section-break;" />
    `;

    activeReport.groups.forEach((group) => {
      const items = group.items || [];
      const legacyImages = group.images?.map(url => ({ type: 'image', url })) || [];
      const legacyNotes = group.notes?.map(text => ({ type: 'note', text })) || [];
      const allItems = items.length > 0 ? items : [...legacyImages, ...legacyNotes];
      const notes = allItems.filter(item => item.type === 'note');
      const images = allItems.filter(item => item.type === 'image');

      let groupHtml = `
        <table width="510" height="720" align="center" style="border: 2pt solid #1a365d; table-layout: fixed; margin-bottom: 0;" cellpadding="20">
          <tr height="720">
            <td align="right" valign="top" height="720">
              <h2 style="font-size: 22pt; color: #1a365d; border-bottom: 1.5pt solid #eee; padding-bottom: 8pt; font-family: Arial; margin-top: 0;">${group.title || 'קבוצה ללא שם'}</h2>
      `;

      notes.forEach(note => {
        groupHtml += `<div style="padding: 10pt; border-right: 5pt solid #3498db; background: #f4f7f9; margin-bottom: 8pt; font-family: Arial; font-size: 13pt;">${note.text}</div>`;
      });

      if (images.length > 0) {
        const cols = images.length === 1 ? 1 : (images.length <= 4 ? 2 : 3);
        const cellWidth = Math.floor(460 / cols);
        
        let imgHeight = 320;
        if (images.length > 1 && images.length <= 3) imgHeight = 200;
        else if (images.length >= 4 && images.length <= 6) imgHeight = 140;
        else if (images.length > 6) imgHeight = 100;

        groupHtml += `<table width="100%" cellspacing="5" cellpadding="0" style="table-layout: fixed; margin-top: 10pt;"><tr>`;
        
        images.forEach((img, idx) => {
          if (idx > 0 && idx % cols === 0) groupHtml += `</tr><tr>`;
          groupHtml += `
            <td valign="top" width="${cellWidth}" style="text-align: center; border: 0.5pt solid #ddd; padding: 4pt;">
              <img src="${img.url || img.localUrl}" height="${imgHeight}" style="display: block; margin: 0 auto; max-width: 100%;" />
              ${img.note ? `<div style="background: #fdf9e7; border-right: 2.5pt solid #f1c40f; padding: 4pt; font-size: 10pt; font-family: Arial; text-align: right; margin-top: 4pt;">${img.note}</div>` : ''}
            </td>`;
        });
        
        const rem = (cols - (images.length % cols)) % cols;
        for(let i=0; i<rem; i++) groupHtml += `<td width="${cellWidth}"></td>`;
        groupHtml += `</tr></table>`;
      }
      
      groupHtml += `</td></tr></table><br clear="all" style="page-break-before:always; mso-break-type:section-break;" />`;
      groupsHtml += groupHtml;
    });

    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset='utf-8'>
        <style>
          @page { size: 595.3pt 841.9pt; margin: 40pt; }
          body { font-family: Arial, sans-serif; direction: rtl; }
        </style>
      </head>
      <body>
        ${coverHtml}
        ${groupsHtml}
      </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeReport.title}.doc`;
    link.click();
  };

  return (
    <div style={reportContainerStyle} dir="rtl">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .report-group-page { height: 96vh !important; page-break-after: always !important; break-after: page !important; display: flex !important; flex-direction: column !important; margin: 0 !important; padding: 25px !important; box-sizing: border-box !important; page-break-inside: avoid !important; border: 2px solid #1a365d !important; }
          .title-page-print { background-color: #f0f7ff !important; border: 8px double #1a365d !important; -webkit-print-color-adjust: exact; justify-content: center !important; }
        }
      `}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => setView('tour')} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToDoc} style={docsBtnStyle}>ייצא ל-Docs</button>
          <button onClick={handlePrint} style={printBtnStyle}>שמור PDF</button>
        </div>
      </div>
      <div id="printable-report-content">
        <div style={titlePageStyle} className="report-group-page title-page-print">
          <div style={{ fontSize: '18px', color: '#3498db', fontWeight: 'bold', marginBottom: '10px' }}>DIPLOMAT GROUP</div>
          <h1 style={{ fontSize: '52px', color: '#1a365d', marginBottom: '10px', fontWeight: '900' }}>{activeReport.title}</h1>
          <div style={{ width: '120px', height: '6px', backgroundColor: '#3498db', margin: '20px auto' }}></div>
          <p style={{ fontSize: '26px', color: '#2c3e50', fontWeight: 'bold' }}>דוח סיור חנות ומדדי ביצוע</p>
          <p style={{ fontSize: '18px', color: '#7f8c8d', marginTop: '50px' }}>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
        </div>
        {activeReport.groups && activeReport.groups.map(group => {
          const items = group.items || [];
          const allItems = items.length > 0 ? items : [...(group.images?.map(url => ({ type: 'image', url })) || []), ...(group.notes?.map(text => ({ type: 'note', text })) || [])];
          const notes = allItems.filter(item => item.type === 'note');
          const images = allItems.filter(item => item.type === 'image');
          return (
            <div key={group.id} className="report-group-page" style={reportGroupStyle}>
              <h3 style={groupHeaderStyle}>{group.title || 'קבוצה ללא שם'}</h3>
              {notes.length > 0 && <div style={notesContainerStyle}>{notes.map((note, i) => <div key={i} style={noteItemStyle}>{note.text}</div>)}</div>}
              {images.length > 0 && (
                <div style={{ ...imageGridContainerStyle, ...getImageGridStyle(images.length) }}>
                  {images.map((img, i) => (
                    <div key={i} style={imageWrapperStyle}>
                      <img src={img.url || img.localUrl} style={imageStyle} alt="store" />
                      {img.note && <div style={attachedNoteOverlayStyle}><strong>הערה:</strong> {img.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const reportContainerStyle = { padding: '20px', width: '100%', boxSizing: 'border-box', margin: '0 auto', backgroundColor: '#f0f2f5', minHeight: '100vh' };
const titlePageStyle = { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: '#f0f7ff', border: '8px double #1a365d', padding: '40px' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '25px', marginBottom: '30px', backgroundColor: 'white', boxSizing: 'border-box', border: '2px solid #1a365d', minHeight: '300px' };
const groupHeaderStyle = { marginTop: 0, color: '#1a365d', borderBottom: '2.5px solid #eee', paddingBottom: '12px', marginBottom: '15px', fontSize: '26px', flexShrink: 0 };
const notesContainerStyle = { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' };
const noteItemStyle = { padding: '12px 18px', background: '#fff', borderRight: '6px solid #3498db', fontSize: '17px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' };
const imageGridContainerStyle = { display: 'grid', gap: '3px', flex: 1, minHeight: 0 };
const imageWrapperStyle = { position: 'relative', height: '100%', width: '100%', minHeight: 0, backgroundColor: '#fdfdfd', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const imageStyle = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };
const attachedNoteOverlayStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 12px', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderTop: '2.5px solid #f1c40f', fontSize: '13px', color: '#1a365d' };
const printBtnStyle = { padding: '12px 24px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const docsBtnStyle = { padding: '12px 24px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '17px' };