import { useState, useRef } from 'react';
import { Camera, FileText, Loader, Edit2, Check, ArrowRight, GripVertical, Plus, Trash2, X, Link } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import AnnotationModal from './AnnotationModal';

export default function ActiveTour({ user, isOnline, activeReport, setActiveReport, setView, closeTour }) {
  const [isUploading, setIsUploading] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState(null);
  const [addingTextGroupId, setAddingTextGroupId] = useState(null);
  const [groupTextNote, setGroupTextNote] = useState('');
  
  const [editingNote, setEditingNote] = useState(null);
  
  // מנוע גרירה חדש ומתוקן
  const draggedItemRef = useRef(null); 
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
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
    if (event.target) event.target.value = '';
  };

  const createNewEmptyGroup = async () => {
    const newGroup = { id: `group_${Date.now()}`, title: '', items: [] };
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

  const deleteItem = async (groupId, itemIndex) => {
    if (!window.confirm("למחוק פריט זה?")) return;
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === groupId);
    if (gIndex > -1) {
      newGroups[gIndex].items.splice(itemIndex, 1);
      const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
      setActiveReport(updatedReport);
      if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
    }
  };

  const detachNoteFromImage = async (groupId, itemIndex) => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === groupId);
    if (gIndex > -1 && newGroups[gIndex].items[itemIndex].type === 'image') {
      const noteText = newGroups[gIndex].items[itemIndex].note;
      newGroups[gIndex].items[itemIndex].note = '';
      newGroups[gIndex].items.splice(itemIndex + 1, 0, { id: `note_${Date.now()}`, type: 'note', text: noteText });
      const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
      setActiveReport(updatedReport);
      if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
    }
  };

  const handleAddGroupText = async (groupId) => {
    if (!groupTextNote.trim()) { setAddingTextGroupId(null); return; }
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === groupId);
    if (gIndex > -1) {
      if (!newGroups[gIndex].items) newGroups[gIndex].items = [];
      newGroups[gIndex].items.push({ id: `note_${Date.now()}`, type: 'note', text: groupTextNote.trim() });
      const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
      setActiveReport(updatedReport);
      setGroupTextNote(''); setAddingTextGroupId(null);
      if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
    }
  };

  // === מנוע גרירה מתוקן ===
  const handleDragStart = (e, sourceGroupId, index) => {
    draggedItemRef.current = { sourceGroupId, index };
    if(e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragEnter = (e, groupId, index) => {
    e.stopPropagation();
    e.preventDefault();
    setDragOverIndex(`${groupId}_${index}`);
  };

  const handleContainerDragEnter = (e, groupId) => {
    e.preventDefault();
    setDragOverIndex(`${groupId}_container`);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleItemDrop = async (e, targetGroupId, targetIndex, isOverImage) => {
    e.stopPropagation();
    e.preventDefault();
    setDragOverIndex(null);

    const source = draggedItemRef.current;
    if (!source) return;

    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const sGIdx = newGroups.findIndex(g => g.id === source.sourceGroupId);
    const tGIdx = newGroups.findIndex(g => g.id === targetGroupId);

    if (sGIdx === -1 || tGIdx === -1) return;

    // הוצאת הפריט שנגרר (וחישוב מחדש של מיקום היעד)
    const [draggedItem] = newGroups[sGIdx].items.splice(source.index, 1);
    
    let adjustedTargetIndex = targetIndex;
    if (source.sourceGroupId === targetGroupId && source.index < targetIndex) {
      adjustedTargetIndex -= 1;
    }

    // אם גררנו טקסט על גבי תמונה - נצמיד אותם
    if (draggedItem.type === 'note' && isOverImage) {
      const targetItem = newGroups[tGIdx].items[adjustedTargetIndex];
      if (targetItem && targetItem.type === 'image') {
        targetItem.note = (targetItem.note ? targetItem.note + " " : "") + draggedItem.text;
      } else {
        newGroups[tGIdx].items.splice(adjustedTargetIndex, 0, draggedItem);
      }
    } else {
      // אחרת, סתם נשנה את המיקום שלו
      newGroups[tGIdx].items.splice(adjustedTargetIndex, 0, draggedItem);
    }

    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    draggedItemRef.current = null;
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const handleContainerDrop = async (e, targetGroupId) => {
    e.preventDefault();
    setDragOverIndex(null);
    const source = draggedItemRef.current;
    if (!source) return;

    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const sGIdx = newGroups.findIndex(g => g.id === source.sourceGroupId);
    const tGIdx = newGroups.findIndex(g => g.id === targetGroupId);
    if (sGIdx === -1 || tGIdx === -1) return;

    const [draggedItem] = newGroups[sGIdx].items.splice(source.index, 1);
    if (!newGroups[tGIdx].items) newGroups[tGIdx].items = [];
    newGroups[tGIdx].items.push(draggedItem);

    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    draggedItemRef.current = null;
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const saveNoteEdit = async () => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === editingNote.groupId);
    if (gIndex > -1) {
      const item = newGroups[gIndex].items[editingNote.index];
      if (item.type === 'note') item.text = editingNote.text;
      else if (item.type === 'image') item.note = editingNote.text;
    }
    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport); setEditingNote(null);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const renderItem = (item, index, groupId) => {
    const isEditing = editingNote?.groupId === groupId && editingNote?.index === index;
    const isDragOver = dragOverIndex === `${groupId}_${index}`;

    if (item.type === 'image') {
      return (
        <div 
          key={item.id} 
          draggable 
          onDragStart={(e) => handleDragStart(e, groupId, index)}
          onDragEnter={(e) => handleItemDragEnter(e, groupId, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleItemDrop(e, groupId, index, true)}
          style={{ ...draggableImgWrapperStyle, border: isDragOver ? '3px solid #3498db' : '2px solid transparent' }}
        >
          <img src={item.url || item.localUrl} style={draggableImgStyle} alt="store item" />
          <button onClick={() => deleteItem(groupId, index)} style={deleteImgOverlayBtnStyle}><X size={14}/></button>
          {item.note && (
            <div style={attachedNoteBadgeStyle}>
              <span style={attachedNoteTextStyle}>{item.note}</span>
              <button onClick={() => detachNoteFromImage(groupId, index)} style={detachBtnStyle} title="נתק הערה מהתמונה"><Link size={10} /></button>
              <button onClick={() => setEditingNote({ groupId, index, text: item.note })} style={editNoteOnImgStyle}><Edit2 size={10} /></button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div 
        key={item.id} 
        draggable 
        onDragStart={(e) => handleDragStart(e, groupId, index)}
        onDragEnter={(e) => handleItemDragEnter(e, groupId, index)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleItemDrop(e, groupId, index, false)}
        style={{ ...draggableNoteStyle, borderTop: isDragOver ? '4px solid #3498db' : 'none' }}
      >
        <GripVertical size={16} color="#bdc3c7" style={{cursor: 'grab'}} />
        {isEditing ? (
          <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
            <textarea value={editingNote.text} onChange={(e) => setEditingNote({...editingNote, text: e.target.value})} style={editInputStyle} rows={2} />
            <button onClick={saveNoteEdit} style={saveEditBtnStyle}><Check size={20} /></button>
          </div>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: '15px' }}>{item.text}</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setEditingNote({ groupId, index, text: item.text })} style={editIconBtnStyle}><Edit2 size={16} /></button>
              <button onClick={() => deleteItem(groupId, index)} style={deleteIconBtnStyle}><Trash2 size={16} color="#e74c3c" /></button>
            </div>
          </>
        )}
      </div>
    );
  };

  const saveGroupTitle = async (groupId) => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const gIndex = newGroups.findIndex(g => g.id === groupId);
    if (gIndex > -1) newGroups[gIndex].title = editGroupTitleText;
    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport); setEditingGroupTitle(null);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  if (isAnnotating) {
    return <AnnotationModal user={user} isOnline={isOnline} pendingPhoto={pendingPhoto} setPendingPhoto={setPendingPhoto} setIsAnnotating={setIsAnnotating} setIsUploading={setIsUploading} activeReport={activeReport} setActiveReport={setActiveReport} targetGroupId={targetGroupId} />;
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

      {(activeReport.groups || []).map((group) => (
        <div 
          key={group.id} 
          onDragEnter={(e) => handleContainerDragEnter(e, group.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleContainerDrop(e, group.id)}
          style={{ ...groupZoneStyle, border: dragOverIndex === `${group.id}_container` ? '2px dashed #3498db' : '1px solid transparent' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
            {editingGroupTitle === group.id ? (
              <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'center' }}>
                <input value={editGroupTitleText} onChange={e => setEditGroupTitleText(e.target.value)} style={editInputStyle} />
                <button onClick={() => saveGroupTitle(group.id)} style={saveEditBtnStyle}><Check size={18} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>{group.title || 'קבוצה ללא שם'}</h3>
                <button onClick={() => { setEditingGroupTitle(group.id); setEditGroupTitleText(group.title || ''); }} style={editIconBtnStyle}><Edit2 size={14} /></button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setTargetGroupId(group.id); fileInputRef.current.click(); }} style={miniActionBtnStyle}>
                {isUploading && targetGroupId === group.id ? <Loader className="spin" size={16} /> : <Camera size={16} color="#34495e" />}
              </button>
              <button onClick={() => setAddingTextGroupId(group.id)} style={miniActionBtnStyle}><FileText size={16} color="#34495e" /></button>
              {(!group.items || group.items.length === 0) && <button onClick={() => deleteEmptyGroup(group.id)} style={miniActionBtnStyle}><Trash2 size={16} color="#e74c3c" /></button>}
            </div>
          </div>

          {addingTextGroupId === group.id && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input type="text" value={groupTextNote} onChange={(e) => setGroupTextNote(e.target.value)} placeholder="הקלד הערה..." style={editInputStyle} autoFocus />
              <button onClick={() => handleAddGroupText(group.id)} style={saveEditBtnStyle}><Check size={20} /></button>
              <button onClick={() => setAddingTextGroupId(null)} style={cancelMiniBtnStyle}><X size={20} /></button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {(group.items || []).map((item, i) => renderItem(item, i, group.id))}
          </div>

          {(!group.items || group.items.length === 0) && addingTextGroupId !== group.id && (
            <p style={{ textAlign: 'center', color: '#bdc3c7', fontSize: '14px', fontStyle: 'italic' }}>הקבוצה ריקה. השתמש באייקונים למעלה.</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Styles
const groupZoneStyle = { display: 'flex', flexDirection: 'column', padding: '20px', backgroundColor: 'white', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const attachedNoteBadgeStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(44, 62, 80, 0.85)', color: 'white', padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' };
const attachedNoteTextStyle = { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const detachBtnStyle = { background: 'none', border: 'none', color: '#3498db', padding: '2px', cursor: 'pointer' };
const editNoteOnImgStyle = { background: 'none', border: 'none', color: '#f1c40f', padding: '2px', cursor: 'pointer' };
const miniActionBtnStyle = { background: '#f0f3f4', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const addGroupBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' };
const draggableNoteStyle = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', backgroundColor: '#fcfcfc', borderRadius: '10px', width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const draggableImgWrapperStyle = { cursor: 'grab', position: 'relative', borderRadius: '10px', overflow: 'hidden', width: '100px', height: '100px' };
const draggableImgStyle = { width: '100%', height: '100%', objectFit: 'cover' };
const deleteImgOverlayBtnStyle = { position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(231, 76, 60, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', padding: '5px', cursor: 'pointer' };
const deleteIconBtnStyle = { background: 'none', border: 'none', padding: '5px', cursor: 'pointer' };
const editInputStyle = { flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer' };
const cancelMiniBtnStyle = { backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer' };