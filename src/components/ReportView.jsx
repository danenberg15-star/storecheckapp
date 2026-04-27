import { useState } from 'react';
import { ArrowRight, Loader } from 'lucide-react';

export default function ReportView({ activeReport, setView }) {
  const [isExporting, setIsExporting] = useState(false);
  if (!activeReport) return null;

  const getImageGridStyle = (count) => {
    if (count <= 1) return { gridTemplateColumns: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (count <= 4) return { gridTemplateColumns: '1fr 1fr' };
    return { gridTemplateColumns: 'repeat(3, 1fr)' };
  };

  const handlePrint = () => {
    const o = document.title;
    document.title = activeReport.title || 'Report';
    window.print();
    document.title = o;
  };

  const getImgSize = (src) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });

  const exportToDoc = async () => {
    setIsExporting(true);
    try {
      let groupsHtml = '';
      const cover = `<table width="480" align="center" style="border: 6pt double #1a365d; background-color: #f0f7ff; margin-bottom: 30pt;" cellpadding="40"><tr><td align="center"><div style="font-size: 14pt; color: #3498db; font-family: Arial;">DIPLOMAT GROUP</div><h1 style="font-size: 32pt; color: #1a365d; font-family: Arial;">${activeReport.title}</h1><div style="width: 100pt; border-top: 3pt solid #3498db; margin: 15pt auto;"></div><p style="font-size: 18pt; color: #2c3e50; font-weight: bold; font-family: Arial;">דוח סיור חנות מקצועי</p><p style="font-size: 12pt; color: #7f8c8d; font-family: Arial;">תאריך: ${new Date(activeReport.createdAt).toLocaleDateString('he-IL')}</p></td></tr></table><br style="page-break-before:always;" />`;

      for (const group of activeReport.groups) {
        const items = group.items || [];
        const notes = items.filter(i => i.type === 'note');
        const images = items.filter(i => i.type === 'image');

        let gHtml = `<table width="480" align="center" style="border: 1.5pt solid #1a365d; table-layout: fixed;" cellpadding="15"><tr><td align="right">`;
        gHtml += `<h2 style="font-size: 18pt; color: #1a365d; border-bottom: 1pt solid #eee; font-family: Arial; margin: 0 0 15pt 0;">${group.title || 'קבוצה'}</h2>`;
        
        // הערות כלליות בראש הקבוצה - נשארו בדיוק כמו שהיו
        notes.forEach(n => {
          gHtml += `<div style="padding: 10pt; border-right: 5pt solid #3498db; background: #f4f7f9; margin-bottom: 10pt; font-family: Arial; font-size: 12pt; direction: rtl; text-align: right;">${n.text}</div>`;
        });

        if (images.length > 0) {
          const cols = images.length === 1 ? 1 : (images.length <= 4 ? 2 : 3);
          const maxW = Math.floor(420 / cols);
          
          gHtml += `<table width="100%" cellspacing="8" cellpadding="0"><tr>`;
          for (let idx = 0; idx < images.length; idx++) {
            const img = images[idx];
            if (idx > 0 && idx % cols === 0) gHtml += `</tr><tr>`;
            
            const size = await getImgSize(img.url || img.localUrl);
            const ratio = size.w / size.h;
            let tw = maxW - 20; let th = tw / ratio;
            if (th > 250) { th = 250; tw = th * ratio; }

            // מסגור התמונה והטקסט הצמוד
            gHtml += `<td align="center" valign="top" style="border: 1pt solid #2c3e50; padding: 8pt; background-color: #ffffff;">
              <img src="${img.url || img.localUrl}" width="${Math.round(tw)}" height="${Math.round(th)}" style="display: block; margin: 0 auto;" />
              ${img.note ? `<div style="background: #fdf9e7; padding: 6pt; font-size: 10pt; font-family: Arial; margin-top: 8pt; direction: rtl; text-align: right; border-top: 1pt solid #eee;"><strong>הערה:</strong> ${img.note}</div>` : ''}
            </td>`;
          }
          const rem = (cols - (images.length % cols)) % cols;
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
      <style>{`
        @media print {
          body { margin: 0; background: white; }
          .no-print { display: none; }
          .report-group-page { height: 96vh; page-break-after: always; display: flex; flex-direction: column; padding: 25px; box-sizing: border-box; border: 1px solid #1a365d; }
          .title-page-print { background-color: #f0f7ff !important; border: 8px double #1a365d !important; -webkit-print-color-adjust: exact; justify-content: center; align-items: center; }
        }
      `}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => setView('tour')} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToDoc} style={docsBtnStyle} disabled={isExporting}>
            {isExporting ? <Loader size={16} className="animate-spin" /> : 'ייצא ל-Docs'}
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
          const items = group.items || [];
          const notes = items.filter(i => i.type === 'note');
          const images = items.filter(i => i.type === 'image');

          return (
            <div key={group.id} className="report-group-page" style={reportGroupStyle}>
              <h3 style={groupHeaderStyle}>{group.title || 'קבוצה'}</h3>
              
              {/* הערות כלליות בראש הקבוצה */}
              {notes.length > 0 && (
                <div style={notesContainerStyle}>
                  {notes.map((n, i) => <div key={i} style={noteItemStyle}>{n.text}</div>)}
                </div>
              )}

              {/* גריד תמונות עם מסגור להערות צמודות */}
              {images.length > 0 && (
                <div style={{ ...imageGridContainerStyle, ...getImageGridStyle(images.length) }}>
                  {images.map((img, i) => (
                    <div key={i} style={imageFrameStyle}>
                      <div style={imageWrapperStyle}>
                        <img src={img.url || img.localUrl} style={imageStyle} alt="store" />
                      </div>
                      {img.note && (
                        <div style={coupledNoteStyle}>
                          <strong>הערה:</strong> {img.note}
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
const reportGroupStyle = { display: 'flex', flexDirection: 'column', padding: '25px', marginBottom: '30px', backgroundColor: 'white', border: '2px solid #1a365d', minHeight: '350px' };
const groupHeaderStyle = { color: '#1a365d', borderBottom: '2.5px solid #eee', paddingBottom: '12px', marginBottom: '15px', fontSize: '26px' };
const notesContainerStyle = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' };
const noteItemStyle = { padding: '12px 18px', borderRight: '6px solid #3498db', fontSize: '17px', background: '#f4f7f9', width: '100%', boxSizing: 'border-box' };

const imageGridContainerStyle = { display: 'grid', gap: '15px', flex: 1 };
const imageFrameStyle = { border: '1px solid #2c3e50', padding: '10px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' };
const imageWrapperStyle = { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdfdfd', height: '250px', overflow: 'hidden' };
const imageStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' };
const coupledNoteStyle = { padding: '8px', backgroundColor: '#fdf9e7', borderRight: '3px solid #f1c40f', fontSize: '14px', color: '#1a365d', direction: 'rtl', textAlign: 'right' };

const printBtnStyle = { padding: '12px 24px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const docsBtnStyle = { padding: '12px 24px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '17px' };