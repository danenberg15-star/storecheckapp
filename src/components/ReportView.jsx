import { useState } from 'react';
import { ArrowRight, Loader } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  const [isExporting, setIsExporting] = useState(false);
  if (!activeReport) return null;

  const getImageGridStyle = (count) => {
    if (count <= 1) return { gridTemplateColumns: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (count <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    return { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '1fr' };
  };

  const handlePrint = () => { const o = document.title; document.title = activeReport.title || 'StoreCheck_Report'; window.print(); document.title = o; };

  const getImgSize = (src) => new Promise(resolve => {
    const img = new Image(); img.onload = () => resolve({ w: img.width, h: img.height }); img.onerror = () => resolve({ w: 400, h: 300 }); img.src = src;
  });

  // לוגיקת הצימוד החכם: קריאת סדר הפריטים וחיבור הערות לתמונות שמעליהן
  const processGroupItems = (group) => {
    const generalNotes = [];
    const processedImages = [];
    let currentImg = null;

    if (group.items && group.items.length > 0) {
      group.items.forEach(item => {
        if (item.type === 'image') {
          currentImg = { ...item, coupledText: item.note ? [item.note] : [] };
          processedImages.push(currentImg);
        } else if (item.type === 'note' || item.type === 'text') {
          if (currentImg) {
            // אם ההערה הגיעה אחרי תמונה - זה צימוד!
            currentImg.coupledText.push(item.text);
          } else {
            // אם ההערה בתחילת הקבוצה - זו הערה כללית
            generalNotes.push(item);
          }
        }
      });
    } else {
      (group.notes || []).forEach(text => generalNotes.push({ text }));
      (group.images || []).forEach(url => processedImages.push({ url, coupledText: [] }));
    }
    return { generalNotes, processedImages };
  };

  const exportToDoc = async () => {
    setIsExporting(true);
    try {
      let groupsHtml = '';
      const cover = `<table width="480" align="center" style="border: 6pt double #1a365d; background-color: #f0f7ff; margin-bottom: 30pt;" cellpadding="40"><tr><td align="center"><div style="font-size: 14pt; color: #3498db; font-weight: bold; font-family: Arial;">DIPLOMAT GROUP</div><h1 style="font-size: 32pt; color: #1a365d; font-family: Arial;">${activeReport.title}</h1><div style="width: 100pt; border-top: 3pt solid #3498db; margin: 15pt auto;"></div><p style="font-size: 18pt; color: #2c3e50; font-weight: bold; font-family: Arial;">דוח סיור חנות מקצועי</p><p style="font-size: 12pt; color: #7f8c8d; font-family: Arial;">תאריך: ${new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p></td></tr></table><br style="page-break-before:always;" />`;

      for (const group of activeReport.groups) {
        const { generalNotes, processedImages } = processGroupItems(group);

        let gHtml = `<table width="480" align="center" style="border: 2pt solid #1a365d; table-layout: fixed;" cellpadding="15"><tr><td align="right" valign="top">`;
        gHtml += `<h2 style="font-size: 18pt; color: #1a365d; border-bottom: 1.5pt solid #eee; padding-bottom: 5pt; font-family: Arial; margin-top: 0; text-align: right; direction: rtl;">${group.title || 'קבוצה'}</h2>`;
        
        generalNotes.forEach(n => { gHtml += `<div style="padding: 10pt; border-right: 5pt solid #3498db; background: #f4f7f9; margin-bottom: 10pt; font-family: Arial; font-size: 12pt; direction: rtl; text-align: right;">${n.text}</div>`; });

        if (processedImages.length > 0) {
          let cols = 1, maxW = 420, maxH = 450;
          if (processedImages.length === 2) { cols = 2; maxW = 200; maxH = 400; }
          else if (processedImages.length <= 4) { cols = 2; maxW = 200; maxH = 200; }
          else { cols = 3; maxW = 130; maxH = 150; }

          gHtml += `<table width="100%" cellspacing="5" cellpadding="0"><tr>`;
          for (let idx = 0; idx < processedImages.length; idx++) {
            const img = processedImages[idx];
            if (idx > 0 && idx % cols === 0) gHtml += `</tr><tr>`;
            
            const size = await getImgSize(img.url || img.localUrl);
            const ratio = size.w / size.h;
            let targetW = maxW; let targetH = targetW / ratio;
            if (targetH > maxH) { targetH = maxH; targetW = targetH * ratio; }

            const noteTxt = img.coupledText.length > 0 ? `<div style="background: #fdf9e7; padding: 4pt; font-size: 9pt; font-family: Arial; margin-top: 4pt; direction: rtl; text-align: right; border-right: 2pt solid #f1c40f;">${img.coupledText.join('<br/>')}</div>` : '';

            gHtml += `<td align="center" valign="top" style="border: 0.5pt solid #eee; padding: 5pt;">
              <img src="${img.url || img.localUrl}" width="${Math.round(targetW)}" height="${Math.round(targetH)}" style="display: block; margin: 0 auto;" />
              ${noteTxt}
            </td>`;
          }
          const rem = (cols - (processedImages.length % cols)) % cols;
          for(let i=0; i<rem; i++) gHtml += `<td></td>`;
          gHtml += `</tr></table>`;
        }
        gHtml += `</td></tr></table><br style="page-break-before:always;" />`;
        groupsHtml += gHtml;
      }

      const body = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset='utf-8'><style>@page { size: A4; margin: 40pt; } body { font-family: Arial, sans-serif; direction: rtl; }</style></head><body>${cover}${groupsHtml}</body></html>`;
      const blob = new Blob(['\ufeff', body], { type: 'application/msword' });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${activeReport.title}.doc`; link.click();
    } finally { setIsExporting(false); }
  };

  return (
    <div style={reportContainerStyle} dir="rtl">
      <style>{`@media print { body { margin: 0; background: white; } .no-print { display: none; } .report-group-page { height: 96vh; page-break-after: always; display: flex; flex-direction: column; padding: 25px; box-sizing: border-box; border: 1px solid #1a365d; } .title-page-print { background-color: #f0f7ff !important; border: 8px double #1a365d !important; -webkit-print-color-adjust: exact; justify-content: center; } }`}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => setView('tour')} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToDoc} style={{...docsBtnStyle, opacity: isExporting ? 0.7 : 1}} disabled={isExporting}>
            {isExporting ? <span style={{display:'flex', alignItems:'center', gap:'5px'}}><Loader size={16} className="spin" /> מחשב...</span> : 'ייצא ל-Docs'}
          </button>
          <button onClick={handlePrint} style={printBtnStyle}>שמור PDF</button>
        </div>
      </div>
      <div id="printable-report-content">
        <div style={titlePageStyle} className="report-group-page title-page-print">
          <div style={{ fontSize: '18px', color: '#3498db', fontWeight: 'bold' }}>DIPLOMAT GROUP</div>
          <h1 style={{ fontSize: '52px', color: '#1a365d', margin: '10px 0' }}>{activeReport.title}</h1>
          <div style={{ width: '100px', height: '6px', backgroundColor: '#3498db', margin: '20px auto' }}></div>
          <p style={{ fontSize: '26px', color: '#2c3e50', fontWeight: 'bold' }}>דוח סיור חנות ומדדי ביצוע</p>
          <p style={{ fontSize: '18px', color: '#7f8c8d', marginTop: '50px' }}>{new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p>
        </div>
        {activeReport.groups && activeReport.groups.map(group => {
          const { generalNotes, processedImages } = processGroupItems(group);
          return (
            <div key={group.id} className="report-group-page" style={reportGroupStyle}>
              <h3 style={groupHeaderStyle}>{group.title || 'קבוצה'}</h3>
              {generalNotes.length > 0 && <div style={notesContainerStyle}>{generalNotes.map((n, i) => <div key={i} style={noteItemStyle}>{n.text}</div>)}</div>}
              {processedImages.length > 0 && (
                <div style={{ ...imageGridContainerStyle, ...getImageGridStyle(processedImages.length) }}>
                  {processedImages.map((img, i) => (
                    <div key={i} style={imageWrapperStyle}>
                      <img src={img.url || img.localUrl} style={imageStyle} alt="store" />
                      {img.coupledText.length > 0 && (
                        <div style={attachedNoteOverlayStyle}>
                          <strong>הערה:</strong> {img.coupledText.join(' | ')}
                        </div>
                      )}
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

const reportContainerStyle = { padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' };
const titlePageStyle = { display: 'flex', flexDirection: 'column', textAlign: 'center', backgroundColor: '#f0f7ff', border: '8px double #1a365d', padding: '40px' };
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '25px', marginBottom: '30px', backgroundColor: 'white', border: '2px solid #1a365d', minHeight: '300px' };
const groupHeaderStyle = { color: '#1a365d', borderBottom: '2.5px solid #eee', paddingBottom: '12px', marginBottom: '15px', fontSize: '26px', margin: 0 };
const notesContainerStyle = { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' };
const noteItemStyle = { padding: '12px 18px', borderRight: '6px solid #3498db', fontSize: '17px', background: '#fff', width: '100%', boxSizing: 'border-box' };
const imageGridContainerStyle = { display: 'grid', gap: '3px', flex: 1, minHeight: 0 };
const imageWrapperStyle = { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdfdfd', overflow: 'hidden', height: '100%' };
const imageStyle = { width: '100%', height: '100%', objectFit: 'contain' };
const attachedNoteOverlayStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 12px', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderTop: '2.5px solid #f1c40f', fontSize: '13px', color: '#1a365d' };
const printBtnStyle = { padding: '12px 24px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const docsBtnStyle = { padding: '12px 24px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '17px' };