import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { SavedNote } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, Image as ImageIcon, Save, Copy, Check, Download, X, PenTool } from 'lucide-react';
import { motion } from 'motion/react';

interface CalendarProps {
  savedNotes: SavedNote[];
  onUpdateNote?: (note: SavedNote) => void;
  onDeleteNote?: (id: string) => void;
  onEditNoteContent?: (note: SavedNote) => void;
}

export default function Calendar({ savedNotes, onUpdateNote, onDeleteNote, onEditNoteContent }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedNote, setSelectedNote] = useState<SavedNote | null>(null);
  const [editingNote, setEditingNote] = useState<SavedNote | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  useEffect(() => {
    setEditingNote(selectedNote ? { ...selectedNote } : null);
  }, [selectedNote]);

  const handleSave = () => {
    if (editingNote && onUpdateNote) {
      onUpdateNote(editingNote);
      setSelectedNote(editingNote); // Update the selected note to reflect changes
      toast.success('保存成功！');
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteNote?.(id);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderCalendarDays = () => {
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-slate-50 border border-slate-100/50"></div>);
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const notesForDay = savedNotes.filter(note => note.date === dateStr);
      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

      days.push(
        <div
          key={day}
          className={`h-32 border border-slate-100 p-2 relative group transition-colors ${isToday ? 'bg-rose-50/30' : 'bg-white'
            } ${dropTargetDate === dateStr ? 'ring-2 ring-rose-400 bg-rose-50' : 'hover:bg-slate-50'
            }`}
          onDragOver={(e) => { e.preventDefault(); setDropTargetDate(dateStr); }}
          onDragLeave={() => setDropTargetDate(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDropTargetDate(null);
            if (draggedNoteId && onUpdateNote) {
              const note = savedNotes.find(n => n.id === draggedNoteId);
              if (note) {
                onUpdateNote({ ...note, date: dateStr });
                toast.success(`已移动到 ${dateStr}`);
              }
            }
            setDraggedNoteId(null);
          }}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-rose-600' : 'text-slate-500'}`}>
            {day} {isToday && <span className="text-xs ml-1">(今天)</span>}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[calc(100%-24px)] custom-scrollbar">
            {notesForDay.map(note => (
              <div
                key={note.id}
                className={`relative group/item ${draggedNoteId === note.id ? 'opacity-40' : ''}`}
                draggable
                onDragStart={() => setDraggedNoteId(note.id)}
                onDragEnd={() => { setDraggedNoteId(null); setDropTargetDate(null); }}
              >
                <button
                  onClick={() => setSelectedNote(note)}
                  title={`拖动可调整日期 · ${note.topic}`}
                  className="w-full text-left bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs p-1.5 pr-6 rounded border border-rose-100 truncate transition-colors flex items-center gap-1 cursor-grab active:cursor-grabbing"
                >
                  {(Array.isArray(note.images) && note.images.length > 0) ? <ImageIcon size={10} className="flex-shrink-0" /> : <FileText size={10} className="flex-shrink-0" />}
                  <span className="truncate">{note.topic}</span>
                </button>
                <button
                  onClick={(e) => handleDelete(e, note.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-rose-200 rounded text-rose-400 hover:text-rose-600 transition-all"
                  title="删除计划"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">运营日历</h2>
          <p className="text-slate-500 mt-1">查看和管理您的内容发布计划。</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-bold text-slate-800 min-w-[120px] text-center">
            {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(day => (
            <div key={day} className="py-3 text-center text-sm font-medium text-slate-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {renderCalendarDays()}
        </div>
      </div>

      {/* Note Detail Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedNote(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <CalendarIcon size={14} />
                    <span>发布日期: {editingNote.date}</span>
                  </div>
                  <input
                    type="text"
                    value={editingNote.topic}
                    onChange={(e) => setEditingNote({ ...editingNote, topic: e.target.value })}
                    className="text-xl font-bold text-slate-900 w-full border-b border-transparent hover:border-slate-200 focus:border-rose-500 focus:outline-none bg-transparent transition-colors py-1"
                  />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onEditNoteContent && (
                    <button
                      onClick={() => {
                        onEditNoteContent(editingNote);
                        setSelectedNote(null);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm shadow-blue-200"
                    >
                      <PenTool size={16} />
                      <span className="hidden sm:inline">到生成器中重写该笔记</span>
                      <span className="sm:hidden">重写</span>
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium shadow-sm shadow-rose-200"
                  >
                    <Save size={16} />
                    保存
                  </button>
                  <button onClick={() => setSelectedNote(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>

              {editingNote.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {editingNote.images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={img} alt={`配图 ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleDownload(img, idx)}
                          className="p-2 bg-white rounded-full text-slate-900 hover:text-rose-500 transition-colors shadow-lg"
                          title="下载图片"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-900">备选标题</h4>
                    <button
                      onClick={() => handleCopy(editingNote.title, 'title')}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded"
                      title="复制标题"
                    >
                      {copiedField === 'title' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <textarea
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full bg-slate-50 p-3 rounded-lg text-slate-700 text-sm border border-transparent focus:border-rose-500 focus:outline-none resize-none transition-all focus:bg-white focus:shadow-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-900">正文内容</h4>
                    <button
                      onClick={() => handleCopy(editingNote.content, 'content')}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded"
                      title="复制正文"
                    >
                      {copiedField === 'content' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <textarea
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className="w-full bg-slate-50 p-4 rounded-lg text-slate-700 text-sm whitespace-pre-wrap leading-relaxed border border-transparent focus:border-rose-500 focus:outline-none min-h-[200px] transition-all focus:bg-white focus:shadow-sm"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">标签</h4>
                  <div className="flex flex-wrap gap-2">
                    {editingNote.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
