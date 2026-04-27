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

  const handlePrint = () => { const o = document.title; document.title = activeReport.title || 'Report'; window.print(); document.title = o; };

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
        gHtml += `<h2 style="font-size: 18pt; color: #1a365d; border-bottom: 1pt solid #eee; font-family: Arial; margin-bottom: 15pt;">${group.title || 'קבוצה'}</h2>`;
        
        notes.forEach(n => {
          gHtml += `<div style="padding: 10pt; border-right: 5pt solid #3498db; background: #f4f7f9; margin-bottom: 10pt; font-family: Arial; font-size: 12pt; direction: rtl; text-align: right;">${n.text}</div>`;
        });

        if (images.length > 0) {
          const cols = images.length === 1 ? 1 : (images.length <= 4 ? 2 : 3);
          const maxW = Math.floor(420 / cols);
          
          gHtml += `<table width="100%" cellspacing="5" cellpadding="0" style="table-layout: fixed;"><tr>`;
          for (let idx = 0; idx < images.length; idx++) {
            const img = images[idx];
            if (idx > 0 && idx % cols === 0) gHtml += `</tr><tr>`;
            
            const size = await getImgSize(img.url || img.localUrl);
            const ratio = size.w / size.h;
            let tw = maxW - 10; let th = 260; // גובה משבצת קבוע

            // חלוקת 85/15 בתוך המשבצת בוורד
            const imgH = img.note ? Math.round(th * 0.8) : th;
            const noteH = th - imgH;

            gHtml += `<td align="center" valign="top" style="border: 1.2pt solid #2c3e50; background-color: #ffffff; padding: 0;">
              <div style="height: ${imgH}pt; overflow: hidden;">
                <img src="${img.url || img.localUrl}" width="${tw}" height="${imgH}" style="display: block; object-fit: cover;" />
              </div>
              ${img.note ? `<div style="height: ${noteH}pt; background: #fdf9e7; padding: 4pt; font-size: 9pt; font-family: Arial; direction: rtl; text-align: right; border-top: 1pt solid #2c3e50; overflow: hidden;">${img.note}</div>` : ''}
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
          .title-page-print { background-color: #f0f7ff !important; border: 8px double #1a365d !important; -webkit-print-color-adjust: exact; justify-content: center; }
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
              
              {notes.length > 0 && (
                <div style={notesContainerStyle}>
                  {notes.map((n, i) => <div key={i} style={noteItemStyle}>{n.text}</div>)}
                </div>
              )}

              {images.length > 0 && (
                <div style={{ ...imageGridContainerStyle, ...getImageGridStyle(images.length) }}>
                  {images.map((img, i) => (
                    <div key={i} style={imageNoteFrameStyle}>
                      <div style={{ height: img.note ? '82%' : '100%', width: '100%', overflow: 'hidden' }}>
                        <img src={img.url || img.localUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="store" />
                      </div>
                      {img.note && (
                        <div style={coupledNoteInnerStyle}>
                          {img.note}
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

const imageGridContainerStyle = { display: 'grid', gap: '10px', flex: 1 };
const imageNoteFrameStyle = { border: '2px solid #2c3e50', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', height: '280px', overflow: 'hidden' };
const coupledNoteInnerStyle = { height: '18%', padding: '6px 10px', backgroundColor: '#fdf9e7', borderTop: '1px solid #2c3e50', fontSize: '13px', color: '#1a365d', overflow: 'hidden', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' };

const printBtnStyle = { padding: '12px 24px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const docsBtnStyle = { padding: '12px 24px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '17px' };