import { useState, useRef } from 'react';
import { Camera, Mic, FileText, Loader, Square, Edit2, Check, ArrowRight, GripVertical, Plus } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// הנה הייבוא של הרכיב החדש שיצרנו!
import AnnotationModal from './AnnotationModal';

export default function ActiveTour({ user, isOnline, activeReport, setActiveReport, setView, closeTour }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  
  const [isAddingText, setIsAddingText] = useState(false);
  const [newTextNote, setNewTextNote] = useState('');
  
  const [editingGroupTitle, setEditingGroupTitle] = useState(null);
  const [editGroupTitleText, setEditGroupTitleText] = useState('');

  // States for Annotation Modal
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  
  const fileInputRef = useRef(null);

  // תופסים את התמונה ומעבירים למודל הציור
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPendingPhoto(objectUrl);
    setIsAnnotating(true);
  };

  const createNewEmptyGroup = async () => {
    const newGroup = { id: `group_${Date.now()}`, title: '', images: [], notes: [] };
    const updatedGroups = [newGroup, ...(activeReport.groups || [])];
    const updatedReport = { ...activeReport, groups: updatedGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: updatedGroups, updatedAt: updatedReport.updatedAt });
  };

  // === Voice & Text Logic ===
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("הדפדפן שלך לא תומך בהקלטה. השתמש בטקסט חופשי.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onerror = (e) => { setIsRecording(false); console.error(e); };
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      const updatedUngrouped = [...(activeReport.ungroupedNotes || []), text];
      const updatedReport = { ...activeReport, ungroupedNotes: updatedUngrouped, updatedAt: new Date().toISOString() };
      
      setActiveReport(updatedReport);
      if (isOnline) { try { await updateDoc(doc(db, "reports", activeReport.id), { ungroupedNotes: updatedUngrouped, updatedAt: updatedReport.updatedAt }); } catch(e) {} }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleAddTextNote = async () => {
    if (!newTextNote.trim()) { setIsAddingText(false); return; }
    const updatedUngrouped = [...(activeReport.ungroupedNotes || []), newTextNote.trim()];
    const updatedReport = { ...activeReport, ungroupedNotes: updatedUngrouped, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    setNewTextNote(''); setIsAddingText(false);
    if (isOnline) { try { await updateDoc(doc(db, "reports", activeReport.id), { ungroupedNotes: updatedUngrouped, updatedAt: updatedReport.updatedAt }); } catch(e) {} }
  };

  // === Drag & Drop Logic (Deep Copy) ===
  const handleDragStart = (e, sourceGroupId, type, index) => {
    setDraggedItem({ sourceGroupId, type, index });
    if(e.dataTransfer) { e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; }
  };
  const handleDragOver = (e, targetGroupId) => { e.preventDefault(); if (dragOverGroupId !== targetGroupId) setDragOverGroupId(targetGroupId); };
  const handleDragLeave = () => setDragOverGroupId(null);
  
  const handleDrop = async (e, targetGroupId) => {
    e.preventDefault(); 
    setDragOverGroupId(null);
    if (!draggedItem) return;
    
    const { sourceGroupId, type, index } = draggedItem;
    if (sourceGroupId === targetGroupId) return;

    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    let newUngroupedNotes = [...(activeReport.ungroupedNotes || [])];
    let newUngroupedImages = [...(activeReport.ungroupedImages || [])];
    let itemContent = null;

    if (sourceGroupId === 'ungrouped') {
      if (type === 'note') { itemContent = newUngroupedNotes[index]; newUngroupedNotes.splice(index, 1); } 
      else { itemContent = newUngroupedImages[index]; newUngroupedImages.splice(index, 1); }
    } else {
      const gIndex = newGroups.findIndex(g => g.id === sourceGroupId);
      if (gIndex > -1) {
        if (type === 'note') { itemContent = newGroups[gIndex].notes[index]; newGroups[gIndex].notes.splice(index, 1); } 
        else { itemContent = newGroups[gIndex].images[index]; newGroups[gIndex].images.splice(index, 1); }
      }
    }

    if (!itemContent) return;

    if (targetGroupId === 'ungrouped') {
      if (type === 'note') newUngroupedNotes.push(itemContent);
      else newUngroupedImages.push(itemContent);
    } else {
      const gIndex = newGroups.findIndex(g => g.id === targetGroupId);
      if (gIndex > -1) {
        if (type === 'note') newGroups[gIndex].notes.push(itemContent);
        else newGroups[gIndex].images.push(itemContent);
      }
    }

    newGroups = newGroups.filter(g => g.images.length > 0 || g.notes.length > 0 || g.title.trim() !== '');

    const updatedReport = { ...activeReport, groups: newGroups, ungroupedNotes: newUngroupedNotes, ungroupedImages: newUngroupedImages, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    setDraggedItem(null);

    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, ungroupedNotes: newUngroupedNotes, ungroupedImages: newUngroupedImages, updatedAt: updatedReport.updatedAt });
  };

  const saveNoteEdit = async () => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    let newUngrouped = [...(activeReport.ungroupedNotes || [])];
    
    if (editingNote.groupId === 'ungrouped') newUngrouped[editingNote.index] = editingNote.text;
    else {
      const gIndex = newGroups.findIndex(g => g.id === editingNote.groupId);
      if (gIndex > -1) newGroups[gIndex].notes[editingNote.index] = editingNote.text;
    }
    
    const updatedReport = { ...activeReport, groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport); setEditingNote(null);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, ungroupedNotes: newUngrouped, updatedAt: updatedReport.updatedAt });
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
      <div key={`note_${index}`} draggable onDragStart={(e) => handleDragStart(e, groupId, 'note', index)} style={draggableNoteStyle}>
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

  const getDropZoneStyle = (isHovered) => ({ padding: '20px', backgroundColor: isHovered ? '#e8f4f8' : '#ecf0f1', borderRadius: '15px', marginBottom: '20px', border: isHovered ? '3px dashed #3498db' : '3px dashed #bdc3c7', minHeight: '120px', transition: 'all 0.2s ease', boxShadow: isHovered ? '0 0 15px rgba(52, 152, 219, 0.3)' : 'none' });
  const getGroupZoneStyle = (isHovered) => ({ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', backgroundColor: isHovered ? '#ebf5fb' : 'white', borderRadius: '15px', marginBottom: '25px', boxShadow: isHovered ? '0 8px 25px rgba(52, 152, 219, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)', border: isHovered ? '3px dashed #3498db' : '3px solid transparent', transition: 'all 0.2s ease', minHeight: '180px' });

  // === RENDER ===

  // קורא לרכיב הציור החדש
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
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={closeTour} style={backBtnStyle}><ArrowRight size={20} /> חזרה</button>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#2c3e50' }}>{activeReport.title}</h2>
      </div>

      <div style={actionGridStyle}>
        <button style={btnStyle} onClick={() => fileInputRef.current.click()} disabled={isUploading}>
          {isUploading ? <Loader className="spin" /> : <Camera size={30} />}
          <span>צילום</span>
        </button>
        <button style={{...btnStyle, backgroundColor: isRecording ? '#e74c3c' : '#2ecc71'}} onClick={startRecording}>
          {isRecording ? <Square size={30} /> : <Mic size={30} />}
          <span>הקלטה</span>
        </button>
      </div>
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <span style={{ fontWeight: 'bold', color: '#34495e', fontSize: '18px' }}>תיעוד וסיווג</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={createNewEmptyGroup} style={addGroupBtnStyle}><Plus size={14}/> קבוצה</button>
          <button onClick={() => setView('report')} style={genBtnStyle}><FileText size={14}/> דוח מלא</button>
        </div>
      </div>

      {/* UNGROUPED ZONE */}
      <div onDragOver={(e) => handleDragOver(e, 'ungrouped')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'ungrouped')} style={getDropZoneStyle(dragOverGroupId === 'ungrouped')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{fontSize: '15px', color: '#34495e', margin: 0}}>אזור חופשי - גרור לפה</h3>
          <button onClick={() => setIsAddingText(true)} style={addTextBtnStyle}><Edit2 size={14} /> טקסט חופשי</button>
        </div>

        {isAddingText && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input type="text" value={newTextNote} onChange={(e) => setNewTextNote(e.target.value)} placeholder="הקלד הערה כאן..." style={editInputStyle} autoFocus />
            <button onClick={handleAddTextNote} style={saveEditBtnStyle}><Check size={20} /></button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
          {(activeReport.ungroupedImages || []).map((imgUrl, i) => (
            <img key={`u_img_${i}`} src={imgUrl} draggable onDragStart={(e) => handleDragStart(e, 'ungrouped', 'image', i)} style={draggableImgStyle} alt="ungrouped" />
          ))}
        </div>

        {(activeReport.ungroupedNotes || []).length === 0 && (activeReport.ungroupedImages || []).length === 0 && !isAddingText ? 
          <p style={{color: '#bdc3c7', fontSize: '14px', fontStyle: 'italic'}}>האזור הכללי ריק.</p> : 
          (activeReport.ungroupedNotes || []).map((n, i) => renderNote(n, i, 'ungrouped'))
        }
      </div>

      {/* IMAGE GROUPS ZONE */}
      {(activeReport.groups || []).map((group) => (
        <div key={group.id} onDragOver={(e) => handleDragOver(e, group.id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, group.id)} style={getGroupZoneStyle(dragOverGroupId === group.id)}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
            {editingGroupTitle === group.id ? (
              <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
                <input value={editGroupTitleText} onChange={e => setEditGroupTitleText(e.target.value)} style={editInputStyle} placeholder="שם הקבוצה (למשל: תצוגת קופה)..." />
                <button onClick={() => saveGroupTitle(group.id)} style={saveEditBtnStyle}><Check size={18} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>{group.title || 'קבוצה ללא שם'}</h3>
                <button onClick={() => { setEditingGroupTitle(group.id); setEditGroupTitleText(group.title || ''); }} style={editIconBtnStyle}><Edit2 size={14} /></button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '20px' }}>
            {group.images.map((imgUrl, i) => (
              <img key={`g_img_${group.id}_${i}`} src={imgUrl} draggable onDragStart={(e) => handleDragStart(e, group.id, 'image', i)} style={draggableImgStyle} alt="group item" />
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {group.notes.length === 0 && group.images.length === 0 ? 
              <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.02)', border: '1px dashed #bdc3c7', color: '#95a5a6', fontSize: '14px', textAlign: 'center' }}>
                הקבוצה ריקה: גרור תמונות או הערות לפה
              </div> : 
              group.notes.map((n, i) => renderNote(n, i, group.id))
            }
          </div>

        </div>
      ))}
    </div>
  );
}

// Static Styles
const actionGridStyle = { display: 'flex', gap: '15px', marginBottom: '30px' };
const btnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '20px', flex: 1, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold' };
const addGroupBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '16px' };
const draggableNoteStyle = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderRight: '5px solid #3498db', marginBottom: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' };
const draggableImgStyle = { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'grab', border: '2px solid transparent', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', padding: '5px' };
const editInputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #bdc3c7', fontFamily: 'Arial' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' };
const addTextBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#fff', color: '#2c3e50', border: '1px solid #bdc3c7', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };