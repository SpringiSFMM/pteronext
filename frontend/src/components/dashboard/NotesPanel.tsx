import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Note } from '../../types';
import { FilePlus2, Pin, Trash2, X, Check, StickyNote, Pencil } from 'lucide-react';

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const NotesPanel: React.FC = () => {
  const { notes, addNote, updateNote, deleteNote, togglePinNote } = useApp();

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const openComposer = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setIsComposerOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setIsComposerOpen(true);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setEditingId(null);
    setTitle('');
    setBody('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;

    if (editingId) {
      updateNote(editingId, { title: title.trim(), body: body.trim() });
    } else {
      addNote({ title, body });
    }
    closeComposer();
  };

  // Pinned notes first, then newest first
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="card p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Notes</h2>
          {notes.length > 0 && (
            <span className="chip">{notes.length}</span>
          )}
        </div>

        {!isComposerOpen ? (
          <button className="btn btn-secondary btn-sm" onClick={openComposer}>
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={closeComposer}>
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Composer */}
      {isComposerOpen && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 view-enter">
          <input
            type="text"
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            autoFocus
          />
          <textarea
            rows={3}
            placeholder="e.g. Backup window Sunday 03:00, update Paper to 1.21.4, …"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="input resize-y"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeComposer}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!title.trim() && !body.trim()}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingId ? 'Save Changes' : 'Add Note'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Note list */}
      <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-80 pr-0.5">
        {sortedNotes.length === 0 && !isComposerOpen && (
          <div className="py-8 text-center">
            <StickyNote className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              No notes yet – keep track of maintenance tasks and credentials hints here.
            </p>
          </div>
        )}

        {sortedNotes.map((note) => (
          <div
            key={note.id}
            className={`group relative p-3 rounded-lg border transition-colors ${
              note.pinned
                ? 'bg-amber-500/[0.06] border-amber-500/25'
                : 'bg-[#0d1117] border-[#30363d] hover:border-[#484f58]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {note.pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                  <h3 className="text-xs font-semibold text-white truncate">{note.title}</h3>
                </div>
                {note.body && (
                  <p className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap break-words line-clamp-4">
                    {note.body}
                  </p>
                )}
                <span className="block text-[10px] font-mono text-slate-600 mt-1.5">
                  {formatRelativeTime(note.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => togglePinNote(note.id)}
                  title={note.pinned ? 'Unpin' : 'Pin to top'}
                  className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <Pin className={`w-3 h-3 ${note.pinned ? 'text-amber-400' : ''}`} />
                </button>
                <button
                  onClick={() => openEdit(note)}
                  title="Edit note"
                  className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteNote(note.id)}
                  title="Delete note"
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
