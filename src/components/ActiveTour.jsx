import { useState, useRef } from 'react';
import { Camera, Mic, FileText, Loader, Edit2, Check, ArrowRight, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import AnnotationModal from './AnnotationModal';

export default function ActiveTour({ user, isOnline, activeReport, setActiveReport, setView, closeTour }) {
  const [isUploading, setIsUploading] = useState(false);
  
  // מעקב אחרי הקבוצה הספציפית שבה אנחנו פועלים עכשיו
  const [targetGroupId, setTargetGroupId] = useState(null);
  const [recordingGroupId, setRecordingGroupId] = useState(null);
  const [addingTextGroupId, setAddingTextGroupId] = useState(null);
  const [groupTextNote, setGroupTextNote] = useState('');
  
  const [editingNote, setEditingNote] = useState(null);
  const draggedItemRef = useRef(null); 
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  
  const [editingGroupTitle, setEditingGroupTitle] = useState(null);
  const [editGroupTitleText, setEditGroupTitleText] = useState('');

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPendingPhoto(objectUrl);
    setIsAnnotating(true);
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const createNewEmptyGroup = async () => {
    const newGroup = { id: `group_${Date.now()}`, title: '', images: [], notes: [] };
    const updatedGroups = [newGroup, ...(activeReport.groups || [])];
    const updatedReport = { ...activeReport, groups: updatedGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: updatedGroups, updatedAt: updatedReport.updatedAt });
  };

  const deleteEmptyGroup = async (groupId) => {
    const newGroups = (activeReport.groups || []).filter(g => g.id !== groupId);
    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  // הקלטה ישירות לקבוצה הספציפית
  const startRecording = (groupId) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("הדפדפן שלך לא תומך בהקלטה. השתמש בטקסט חופשי.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.onstart = () => setRecordingGroupId(groupId);
    recognition.onerror = (e) => { setRecordingGroupId(null); console.error(e); };
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
      const gIndex = newGroups.findIndex(g => g.id === groupId);
      if (gIndex > -1) {
        newGroups[gIndex].notes.push(text);
        const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
        setActiveReport(updatedReport);
        if (isOnline) { try { await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt }); } catch(e) {} }
      }
    };
    recognition.onend = () => setRecordingGroupId(null);
    recognition.start();
  };

  // הוספת טקסט ישירות לקבוצה הספציפית
  const handleAddGroupText = async (groupId) => {
    if (!groupTextNote.trim()) { setAddingTextGroupId(null); return; }
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === groupId);
    if (gIndex > -1) {
      newGroups[gIndex].notes.push(groupTextNote.trim());
      const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
      setActiveReport(updatedReport);
      setGroupTextNote(''); 
      setAddingTextGroupId(null);
      if (isOnline) { try { await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt }); } catch(e) {} }
    }
  };

  // === Drag & Drop Logic (עודכן כדי לתמוך רק בקבוצות) ===
  const handleDragStart = (e, sourceGroupId, type, index) => {
    draggedItemRef.current = { sourceGroupId, type, index };
    if(e.dataTransfer) { e.dataTransfer.setData('text/plain', type); e.dataTransfer.effectAllowed = 'move'; }
  };
  const handleDragEnd = () => { draggedItemRef.current = null; setDragOverGroupId(null); };
  const handleDragEnter = (e, targetGroupId) => {
    e.preventDefault();
    if (dragOverGroupId !== targetGroupId) setDragOverGroupId(targetGroupId);
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  
  const handleDrop = async (e, targetGroupId) => {
    e.preventDefault(); 
    setDragOverGroupId(null);
    
    const item = draggedItemRef.current;
    if (!item) return;
    
    const { sourceGroupId, type, index } = item;
    if (sourceGroupId === targetGroupId) return;

    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    let itemContent = null;

    const sourceIndex = newGroups.findIndex(g => g.id === sourceGroupId);
    if (sourceIndex > -1) {
      if (type === 'note') { itemContent = newGroups[sourceIndex].notes[index]; newGroups[sourceIndex].notes.splice(index, 1); } 
      else { itemContent = newGroups[sourceIndex].images[index]; newGroups[sourceIndex].images.splice(index, 1); }
    }

    if (!itemContent) return;

    const targetIndex = newGroups.findIndex(g => g.id === targetGroupId);
    if (targetIndex > -1) {
      if (type === 'note') newGroups[targetIndex].notes.push(itemContent);
      else newGroups[targetIndex].images.push(itemContent);
    }

    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    draggedItemRef.current = null;

    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const saveNoteEdit = async () => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === editingNote.groupId);
    if (gIndex > -1) newGroups[gIndex].notes[editingNote.index] = editingNote.text;
    
    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport); setEditingNote(null);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const saveGroupTitle = async (groupId) => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === groupId);
    if (gIndex > -1) newGroups[gIndex].title = editGroupTitleText;
    
    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport); setEditingGroupTitle(null);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const renderNote = (noteText, index, groupId) => {
    const isEditing = editingNote?.groupId === groupId && editingNote?.index === index;
    return (
      <div 
        key={`note_${groupId}_${index}`} 
        draggable 
        onDragStart={(e) => handleDragStart(e, groupId, 'note', index)} 
        onDragEnd={handleDragEnd}
        style={draggableNoteStyle}
      >
        <GripVertical size={16} color="#bdc3c7" style={{cursor: 'grab'}} />
        {isEditing ? (
          <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
            <textarea value={editingNote.text} onChange={(e) => setEditingNote({...editingNote, text: e.target.value})} style={editInputStyle} rows={2} />
            <button onClick={saveNoteEdit} style={saveEditBtnStyle}><Check size={20} /></button>
          </div>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: '15px', lineHeight: '1.4' }}>{noteText}</span>
            <button onClick={() => setEditingNote({ groupId, index, text: noteText })} style={editIconBtnStyle}><Edit2 size={16} /></button>
          </>
        )}
      </div>
    );
  };

  const getGroupZoneStyle = (isHovered) => ({ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', backgroundColor: isHovered ? '#ebf5fb' : 'white', borderRadius: '15px', marginBottom: '25px', boxShadow: isHovered ? '0 8px 25px rgba(52, 152, 219, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)', border: isHovered ? '3px dashed #3498db' : '3px solid transparent', transition: 'all 0.2s ease', minHeight: '180px' });

  // === RENDER ===
  if (isAnnotating) {
    return (
      <AnnotationModal 
        user={user}
        isOnline={isOnline}
        pendingPhoto={pendingPhoto}
        setPendingPhoto={setPendingPhoto}
        setIsAnnotating={setIsAnnotating}
        setIsUploading={setIsUploading}
        activeReport={activeReport}
        setActiveReport={setActiveReport}
        targetGroupId={targetGroupId} // העברת מזהה הקבוצה הספציפית
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={closeTour} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#2c3e50' }}>{activeReport.title}</h2>
      </div>

      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#e8f4f8', padding: '15px', borderRadius: '12px' }}>
        <span style={{ fontWeight: 'bold', color: '#34495e', fontSize: '16px' }}>פעולות סיור</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={createNewEmptyGroup} style={addGroupBtnStyle}><Plus size={16}/> הוסף קבוצה</button>
          <button onClick={() => setView('report')} style={genBtnStyle}><FileText size={16}/> דוח מלא</button>
        </div>
      </div>

      {/* אזור חופשי נמחק לחלוטין מכאן */}

      {/* IMAGE GROUPS ZONE */}
      {(activeReport.groups || []).map((group) => (
        <div 
          key={group.id} 
          onDragEnter={(e) => handleDragEnter(e, group.id)} 
          onDragOver={handleDragOver} 
          onDrop={(e) => handleDrop(e, group.id)} 
          style={getGroupZoneStyle(dragOverGroupId === group.id)}
        >
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
            {editingGroupTitle === group.id ? (
              <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'center', marginLeft: '10px' }}>
                <input value={editGroupTitleText} onChange={e => setEditGroupTitleText(e.target.value)} style={editInputStyle} placeholder="שם הקבוצה..." />
                <button onClick={() => saveGroupTitle(group.id)} style={saveEditBtnStyle}><Check size={18} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>{group.title || 'קבוצה ללא שם'}</h3>
                <button onClick={() => { setEditingGroupTitle(group.id); setEditGroupTitleText(group.title || ''); }} style={editIconBtnStyle}><Edit2 size={14} /></button>
              </div>
            )}

            {/* אייקוני הפעולות החדשים של הקבוצה */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => { setTargetGroupId(group.id); fileInputRef.current.click(); }} 
                style={miniActionBtnStyle} title="צלם תמונה לקבוצה זו">
                {isUploading && targetGroupId === group.id ? <Loader className="spin" size={16} /> : <Camera size={16} color="#34495e" />}
              </button>
              <button 
                onClick={() => startRecording(group.id)} 
                style={{...miniActionBtnStyle, backgroundColor: recordingGroupId === group.id ? '#e74c3c' : '#f0f3f4'}} 
                title="הקלט הערה לקבוצה זו">
                <Mic size={16} color={recordingGroupId === group.id ? 'white' : '#34495e'} />
              </button>
              <button 
                onClick={() => setAddingTextGroupId(group.id)} 
                style={miniActionBtnStyle} title="הוסף טקסט חופשי לקבוצה זו">
                <FileText size={16} color="#34495e" />
              </button>
              
              {group.images.length === 0 && group.notes.length === 0 && (
                <button onClick={() => deleteEmptyGroup(group.id)} style={miniActionBtnStyle} title="מחק קבוצה ריקה">
                  <Trash2 size={16} color="#e74c3c" />
                </button>
              )}
            </div>
          </div>

          {/* תיבת הקלדת טקסט של הקבוצה (מופיעה רק כשיש לחיצה) */}
          {addingTextGroupId === group.id && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input type="text" value={groupTextNote} onChange={(e) => setGroupTextNote(e.target.value)} placeholder="הקלד הערה לקבוצה זו..." style={editInputStyle} autoFocus />
              <button onClick={() => handleAddGroupText(group.id)} style={saveEditBtnStyle}><Check size={20} /></button>
              <button onClick={() => setAddingTextGroupId(null)} style={cancelMiniBtnStyle}><X size={20} /></button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '20px' }}>
            {group.images.map((imgUrl, i) => (
              <div 
                key={`g_img_${group.id}_${i}`} 
                draggable 
                onDragStart={(e) => handleDragStart(e, group.id, 'image', i)} 
                onDragEnd={handleDragEnd}
                style={draggableImgWrapperStyle}
              >
                <img src={imgUrl} style={draggableImgStyle} alt="group item" />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {group.notes.length === 0 && group.images.length === 0 && addingTextGroupId !== group.id ? 
              <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)', border: '1px dashed #bdc3c7', color: '#95a5a6', fontSize: '14px', textAlign: 'center' }}>
                הקבוצה ריקה. השתמש באייקונים למעלה כדי להוסיף תוכן.
              </div> : 
              group.notes.map((n, i) => renderNote(n, i, group.id))
            }
          </div>

        </div>
      ))}
      
      {(!activeReport.groups || activeReport.groups.length === 0) && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7f8c8d' }}>
          <h3>אין קבוצות בסיור זה.</h3>
          <p>לחץ על "הוסף קבוצה" כדי להתחיל לתעד את החנות.</p>
        </div>
      )}
    </div>
  );
}

// Static Styles
const miniActionBtnStyle = { background: '#f0f3f4', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' };
const addGroupBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };
const draggableNoteStyle = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderRight: '5px solid #3498db', marginBottom: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', cursor: 'grab', touchAction: 'none' };
const draggableImgWrapperStyle = { cursor: 'grab', display: 'inline-block', borderRadius: '8px', overflow: 'hidden', border: '2px solid transparent', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', touchAction: 'none' };
const draggableImgStyle = { width: '80px', height: '80px', objectFit: 'cover', display: 'block', pointerEvents: 'none' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: '5px' };
const editInputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #bdc3c7', fontFamily: 'Arial' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' };
const cancelMiniBtnStyle = { backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' };