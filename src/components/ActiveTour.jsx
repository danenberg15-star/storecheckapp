import { useState, useRef } from 'react';
import { Camera, FileText, Loader, Edit2, Check, ArrowRight, GripVertical, Plus, Trash2, X, Link, Save } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import AnnotationModal from './AnnotationModal';

export default function ActiveTour({ user, isOnline, activeReport, setActiveReport, setView, closeTour }) {
  const [isUploading, setIsUploading] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState(null);
  const [addingTextGroupId, setAddingTextGroupId] = useState(null);
  const [groupTextNote, setGroupTextNote] = useState('');
  
  // ניהול עריכת טקסט בחלון גדול
  const [editingNote, setEditingNote] = useState(null); // { groupId, index, text }
  
  const draggedItemRef = useRef(null); 
  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [primedItemId, setPrimedItemId] = useState(null);

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

  // === מנוע גרירה ומיקום ===
  const executeDrop = async (sourceGroupId, sourceIndex, targetGroupId, targetIndex, isOverImage) => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const sGIdx = newGroups.findIndex(g => g.id === sourceGroupId);
    const tGIdx = newGroups.findIndex(g => g.id === targetGroupId);
    if (sGIdx === -1 || tGIdx === -1) return;

    const [draggedItem] = newGroups[sGIdx].items.splice(sourceIndex, 1);
    let adjustedTargetIndex = targetIndex;
    if (sourceGroupId === targetGroupId && sourceIndex < targetIndex) adjustedTargetIndex -= 1;

    if (draggedItem.type === 'note' && isOverImage) {
      const targetItem = newGroups[tGIdx].items[adjustedTargetIndex];
      if (targetItem && targetItem.type === 'image') {
        targetItem.note = (targetItem.note ? targetItem.note + " " : "") + draggedItem.text;
      } else {
        newGroups[tGIdx].items.splice(adjustedTargetIndex, 0, draggedItem);
      }
    } else {
      newGroups[tGIdx].items.splice(adjustedTargetIndex, 0, draggedItem);
    }

    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  const executeContainerDrop = async (sourceGroupId, sourceIndex, targetGroupId) => {
    let newGroups = JSON.parse(JSON.stringify(activeReport.groups || []));
    const sGIdx = newGroups.findIndex(g => g.id === sourceGroupId);
    const tGIdx = newGroups.findIndex(g => g.id === targetGroupId);
    if (sGIdx === -1 || tGIdx === -1) return;

    const [draggedItem] = newGroups[sGIdx].items.splice(sourceIndex, 1);
    if (!newGroups[tGIdx].items) newGroups[tGIdx].items = [];
    newGroups[tGIdx].items.push(draggedItem);

    const updatedReport = { ...activeReport, groups: newGroups, updatedAt: new Date().toISOString() };
    setActiveReport(updatedReport);
    if (isOnline) await updateDoc(doc(db, "reports", activeReport.id), { groups: newGroups, updatedAt: updatedReport.updatedAt });
  };

  // === מגע ולחיצה ארוכה ===
  const handleTouchStart = (e, sourceGroupId, index, itemId) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      setPrimedItemId(itemId);
      draggedItemRef.current = { sourceGroupId, index };
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    if (!primedItemId) {
      const dist = Math.sqrt(Math.pow(touch.clientX - touchStartPos.current.x, 2) + Math.pow(touch.clientY - touchStartPos.current.y, 2));
      if (dist > 10) clearTimeout(longPressTimer.current);
      return;
    }
    e.preventDefault();
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
       const dropZone = element.closest('[data-droppable="true"]');
       if (dropZone) {
          const tGroupId = dropZone.getAttribute('data-group-id');
          const tIndex = dropZone.getAttribute('data-index');
          setDragOverIndex(`${tGroupId}_${tIndex}`);
       } else {
          const containerZone = element.closest('[data-container-group-id]');
          if (containerZone) setDragOverIndex(`${containerZone.getAttribute('data-container-group-id')}_container`);
          else setDragOverIndex(null);
       }
    }
  };

  const handleTouchEnd = async (e) => {
    clearTimeout(longPressTimer.current);
    if (!primedItemId) return;
    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
       const dropZone = element.closest('[data-droppable="true"]');
       if (dropZone) {
          const tGroupId = dropZone.getAttribute('data-group-id');
          const tIndex = parseInt(dropZone.getAttribute('data-index'), 10);
          const tType = dropZone.getAttribute('data-type');
          await executeDrop(draggedItemRef.current.sourceGroupId, draggedItemRef.current.index, tGroupId, tIndex, tType === 'image');
       } else {
          const containerZone = element.closest('[data-container-group-id]');
          if (containerZone) {
             const tGroupId = containerZone.getAttribute('data-container-group-id');
             await executeContainerDrop(draggedItemRef.current.sourceGroupId, draggedItemRef.current.index, tGroupId);
          }
       }
    }
    setDragOverIndex(null);
    setPrimedItemId(null);
    draggedItemRef.current = null;
  };

  const handleDragStart = (e, sourceGroupId, index) => {
    draggedItemRef.current = { sourceGroupId, index };
    if(e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
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
    const isDragOver = dragOverIndex === `${groupId}_${index}`;
    const isPrimed = primedItemId === item.id;

    const commonProps = {
      key: item.id,
      draggable: true,
      "data-droppable": "true",
      "data-group-id": groupId,
      "data-index": index,
      "data-type": item.type,
      onDragStart: (e) => handleDragStart(e, groupId, index),
      onDragOver: (e) => e.preventDefault(),
      onDrop: (e) => primedItemId ? null : executeDrop(draggedItemRef.current.sourceGroupId, draggedItemRef.current.index, groupId, index, item.type === 'image'),
      onTouchStart: (e) => handleTouchStart(e, groupId, index, item.id),
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    };

    const itemStyle = {
      transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      transform: isPrimed ? 'scale(1.08)' : 'scale(1)',
      boxShadow: isPrimed ? '0 10px 20px rgba(0,0,0,0.15)' : 'none',
      zIndex: isPrimed ? 50 : 1
    };

    if (item.type === 'image') {
      return (
        <div {...commonProps} style={{ ...draggableImgWrapperStyle, ...itemStyle, border: isDragOver ? '3px solid #3498db' : '2px solid transparent' }}>
          <img src={item.url || item.localUrl} style={draggableImgStyle} alt="store item" />
          <button onClick={() => deleteItem(groupId, index)} style={deleteImgOverlayBtnStyle}><X size={14}/></button>
          {item.note && (
            <div style={attachedNoteBadgeStyle}>
              <span style={attachedNoteTextStyle}>{item.note}</span>
              <button onClick={() => detachNoteFromImage(groupId, index)} style={detachBtnStyle}><Link size={10} /></button>
              <button onClick={() => setEditingNote({ groupId, index, text: item.note })} style={editNoteOnImgStyle}><Edit2 size={10} /></button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div {...commonProps} style={{ ...draggableNoteStyle, ...itemStyle, borderTop: isDragOver ? '4px solid #3498db' : 'none' }}>
        <GripVertical size={16} color="#bdc3c7" style={{cursor: 'grab'}} />
        <span style={{ flex: 1, fontSize: '15px' }}>{item.text}</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => setEditingNote({ groupId, index, text: item.text })} style={editIconBtnStyle}><Edit2 size={16} /></button>
          <button onClick={() => deleteItem(groupId, index)} style={deleteIconBtnStyle}><Trash2 size={16} color="#e74c3c" /></button>
        </div>
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
    <div style={{ position: 'relative' }}>
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
          data-container-group-id={group.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => executeContainerDrop(draggedItemRef.current.sourceGroupId, draggedItemRef.current.index, group.id)}
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
        </div>
      ))}

      {/* חלון עריכה גדול (Modal) */}
      {editingNote && (
        <div style={fullModalOverlayStyle}>
          <div style={fullModalContentStyle}>
            <div style={fullModalHeaderStyle}>
              <h3 style={{ margin: 0 }}>עריכת הערה</h3>
              <button onClick={() => setEditingNote(null)} style={{ background: 'none', border: 'none' }}><X size={24} /></button>
            </div>
            <textarea 
              value={editingNote.text} 
              onChange={(e) => setEditingNote({...editingNote, text: e.target.value})} 
              style={fullModalTextareaStyle}
              autoFocus
            />
            <button onClick={saveNoteEdit} style={fullModalSaveBtnStyle}>
              <Save size={20} /> שמור שינויים
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const fullModalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' };
const fullModalContentStyle = { backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '15px', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' };
const fullModalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const fullModalTextareaStyle = { width: '100%', minHeight: '200px', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '16px', fontFamily: 'Arial', boxSizing: 'border-box', outline: 'none', resize: 'none' };
const fullModalSaveBtnStyle = { marginTop: '20px', padding: '15px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' };

const groupZoneStyle = { display: 'flex', flexDirection: 'column', padding: '20px', backgroundColor: 'white', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const attachedNoteBadgeStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(44, 62, 80, 0.85)', color: 'white', padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' };
const attachedNoteTextStyle = { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const detachBtnStyle = { background: 'none', border: 'none', color: '#3498db', padding: '2px' };
const editNoteOnImgStyle = { background: 'none', border: 'none', color: '#f1c40f', padding: '2px' };
const miniActionBtnStyle = { background: '#f0f3f4', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addGroupBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold' };
const genBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold' };
const backBtnStyle = { border: 'none', background: 'none', color: '#3498db', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' };
const draggableNoteStyle = { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', backgroundColor: '#fcfcfc', borderRadius: '10px', width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', touchAction: 'pan-y' };
const draggableImgWrapperStyle = { cursor: 'grab', position: 'relative', borderRadius: '10px', overflow: 'hidden', width: '100px', height: '100px', touchAction: 'pan-y' };
const draggableImgStyle = { width: '100%', height: '100%', objectFit: 'cover' };
const deleteImgOverlayBtnStyle = { position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(231, 76, 60, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const editIconBtnStyle = { background: 'none', border: 'none', color: '#95a5a6', padding: '5px' };
const deleteIconBtnStyle = { background: 'none', border: 'none', padding: '5px' };
const editInputStyle = { flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' };
const saveEditBtnStyle = { backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px' };
const cancelMiniBtnStyle = { backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px' };