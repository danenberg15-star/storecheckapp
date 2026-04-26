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

  const handlePrint = () => { const originalTitle = document.title; document.title = activeReport.title || 'StoreCheck_Report'; window.print(); document.title = originalTitle; };

  const exportToDoc = () => {
    let groupsHtml = '';
    activeReport.groups.forEach((group) => {
      const items = group.items || [];
      const legacyImages = group.images?.map(url => ({ type: 'image', url })) || [];
      const legacyNotes = group.notes?.map(text => ({ type: 'note', text })) || [];
      const allItems = items.length > 0 ? items : [...legacyImages, ...legacyNotes];
      const notes = allItems.filter(item => item.type === 'note');
      const images = allItems.filter(item => item.type === 'image');

      let groupHtml = `<div class="report-group-page" style="border: 1px solid #2c3e50; padding: 20px; margin-bottom: 20px;"><h2 style="font-size: 22pt; color: #2c3e50; border-bottom: 2px solid #eee; text-align: right; direction: rtl;">${group.title || 'קבוצה ללא שם'}</h2>`;
      notes.forEach(note => { groupHtml += `<div style="padding: 10px; border-right: 5px solid #3498db; background: #f4f7f9; margin-bottom: 10px; text-align: right; direction: rtl;">${note.text}</div>`; });
      if (images.length > 0) {
        const cols = images.length === 1 ? 1 : (images.length <= 4 ? 2 : 3);
        const colWidth = Math.floor(100 / cols) + '%';
        groupHtml += `<table width="100%" cellspacing="5" style="table-layout: fixed;"><tr>`;
        images.forEach((img, idx) => {
          if (idx > 0 && idx % cols === 0) groupHtml += `</tr><tr>`;
          groupHtml += `<td valign="top" width="${colWidth}" style="border: 1px solid #eee; text-align: center;"><img src="${img.url || img.localUrl}" width="100%" style="max-width: 100%; height: auto;" />${img.note ? `<div style="background: #f1c40f22; border-right: 3px solid #f1c40f; padding: 5px; text-align: right; direction: rtl;"><strong>הערה:</strong> ${img.note}</div>` : ''}</td>`;
        });
        groupHtml += `</tr></table>`;
      }
      groupHtml += `</div><br style="page-break-before:always; mso-break-type:section-break;" />`;
      groupsHtml += groupHtml;
    });

    const header = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset='utf-8'><style>@page { size: A4; margin: 1cm; } body { font-family: Arial; direction: rtl; }</style></head><body><div style="border: 4px double #2c3e50; padding: 50px; text-align: center; background-color: #f4f7f9; margin-bottom: 50px;"><h1 style="font-size: 40pt; color: #2c3e50;">${activeReport.title}</h1><p style="font-size: 20pt; color: #34495e;">דוח סיור חנות מקצועי</p><p style="font-size: 16pt;">תאריך: ${new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p></div><br style="page-break-before:always; mso-break-type:section-break;" />${groupsHtml}</body></html>`;
    
    const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeReport.title}.doc`;
    link.click();
  };

  return (
    <div style={reportContainerStyle} dir="rtl">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .report-group-page { height: 96vh !important; page-break-after: always !important; break-after: page !important; display: flex !important; flex-direction: column !important; margin: 0 !important; padding: 20px !important; box-sizing: border-box !important; page-break-inside: avoid !important; border: 1px solid #2c3e50 !important; }
          .title-page-print { background-color: #f0f4f8 !important; border: 6px double #2c3e50 !important; -webkit-print-color-adjust: exact; justify-content: center !important; align-items: center !important; text-align: center !important; }
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
          <h1 style={{ fontSize: '48px', color: '#1a252f', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>{activeReport.title}</h1>
          <div style={{ width: '100px', height: '4px', backgroundColor: '#3498db', margin: '20px auto' }}></div>
          <p style={{ fontSize: '24px', color: '#34495e', fontWeight: 'bold' }}>דוח סיור חנות ומדדי ביצוע</p>
          <p style={{ fontSize: '18px', color: '#7f8c8d', marginTop: '40px' }}>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
        </div>

        {activeReport.groups && activeReport.groups.map(group => {
          const items = group.items || [];
          const allItems = items.length > 0 ? items : [...(group.images?.map(url => ({ type: 'image', url })) || []), ...(group.notes?.map(text => ({ type: 'note', text })) || [])];
          const notes = allItems.filter(item => item.type === 'note');
          const images = allItems.filter(item => item.type === 'image');

          return (
            <div key={group.id} className="report-group-page" style={reportGroupStyle}>
              <h3 style={groupHeaderStyle}>{group.title || 'קבוצה ללא שם'}</h3>
              {notes.length > 0 && <div style={notesContainerStyle}>{notes.map((note, idx) => <div key={note.id || idx} style={noteItemStyle}>{note.text}</div>)}</div>}
              {images.length > 0 && (
                <div style={{ ...imageGridContainerStyle, ...getImageGridStyle(images.length) }}>
                  {images.map((img, idx) => (
                    <div key={img.id || idx} style={imageWrapperStyle}>
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

const reportContainerStyle = { padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: '0 auto', backgroundColor: '#f0f2f5', minHeight: '100vh' };
const titlePageStyle = { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: '#f8fafc', border: '8px double #2c3e50', padding: '40px', minHeight: '300px' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '20px', borderRadius: '0px', marginBottom: '30px', backgroundColor: 'white', boxSizing: 'border-box', border: '1px solid #2c3e50', minHeight: '300px' };
const groupHeaderStyle = { marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '10px', fontSize: '24px', flexShrink: 0 };
const notesContainerStyle = { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', flexShrink: 0 };
const noteItemStyle = { padding: '10px 15px', background: '#fff', borderRight: '5px solid #3498db', fontSize: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderRadius: '4px', width: '100%', boxSizing: 'border-box' };
const imageGridContainerStyle = { display: 'grid', gap: '2px', flex: 1, minHeight: 0 };
const imageWrapperStyle = { position: 'relative', height: '100%', width: '100%', minHeight: 0, backgroundColor: '#fdfdfd', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const imageStyle = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };
const attachedNoteOverlayStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 10px', backgroundColor: 'rgba(255, 255, 255, 0.85)', borderTop: '2px solid #f1c40f', fontSize: '12px', color: '#2c3e50' };
const printBtnStyle = { padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const docsBtnStyle = { padding: '10px 20px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };