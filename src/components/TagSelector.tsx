import { useState } from 'react';
import { Tag } from '../types';
import { createTag, deleteTag, updateTag } from '../db/queries';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c',
  '#64748b', '#0f172a',
];

interface TagSelectorProps {
  selectedIds: number[];
  allTags: Tag[];
  onChange: (ids: number[]) => void;
  onTagsRefresh: () => void;
}

export default function TagSelector({ selectedIds, allTags, onChange, onTagsRefresh }: TagSelectorProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [showInput, setShowInput] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const toggleTag = (tagId: number) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      await createTag({ name, color: newTagColor, type: 'experiment' });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowInput(false);
      onTagsRefresh();
    } catch {
      // tag already exists or db error
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!name || editingId === null) return;
    try {
      await updateTag(editingId, { name, color: editColor });
      cancelEdit();
      onTagsRefresh();
    } catch {
      // handle error silently
    }
  };

  const confirmDelete = async () => {
    if (deletingId === null) return;
    try {
      await deleteTag(deletingId);
      setDeletingId(null);
      onTagsRefresh();
    } catch {
      // handle error silently
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-sm">
        <h3 className="section-title mb-0">标签</h3>
        <button
          type="button"
          onClick={() => setShowInput(!showInput)}
          className="btn-ghost text-primary-500 flex items-center gap-xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建标签
        </button>
      </div>

      <div className="flex flex-wrap gap-sm">
        {allTags.map((tag) => {
          const isEditing = editingId === tag.id;
          const selected = selectedIds.includes(tag.id);

          if (isEditing) {
            return (
              <div
                key={tag.id}
                className="flex items-center gap-xs px-sm py-xs rounded-md border border-primary-400 bg-white shadow-sm"
              >
                <div className="flex items-center gap-xs flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        editColor === c ? 'border-gray-800 scale-125' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="w-px h-5 bg-gray-200 mx-xs" />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="input-field w-[120px]"
                  autoFocus
                />
                <button type="button" onClick={saveEdit} className="btn-primary text-caption px-xs py-1">
                  保存
                </button>
                <button type="button" onClick={cancelEdit} className="btn-ghost text-caption px-xs py-1">
                  取消
                </button>
              </div>
            );
          }

          return (
            <div key={tag.id} className="relative group">
              <button
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`px-sm py-xs rounded-md text-caption transition-all duration-150 border ${
                  selected
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
                style={selected ? { borderColor: tag.color, backgroundColor: `${tag.color}18` } : undefined}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-xs" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
              {/* hover actions */}
              <div className="absolute -top-1 -right-1 hidden group-hover:flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startEdit(tag); }}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-500 hover:text-primary-600 hover:border-primary-400 shadow-sm"
                  title="编辑"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDeletingId(tag.id); }}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-400 shadow-sm"
                  title="删除"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
        {allTags.length === 0 && (
          <p className="text-gray-400 text-caption">暂无标签，点击"新建标签"创建</p>
        )}
      </div>

      {/* create new tag */}
      {showInput && (
        <div className="flex items-center gap-sm mt-sm flex-wrap">
          <div className="flex items-center gap-xs">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewTagColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  newTagColor === c ? 'border-gray-800 scale-125' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="w-px h-5 bg-gray-200 mx-xs" />
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            placeholder="输入标签名"
            className="input-field w-[160px]"
            autoFocus
          />
          <button type="button" onClick={handleCreateTag} className="btn-primary">
            确认
          </button>
          <button
            type="button"
            onClick={() => { setShowInput(false); setNewTagName(''); setNewTagColor('#3b82f6'); }}
            className="btn-ghost"
          >
            取消
          </button>
        </div>
      )}

      {/* delete confirm modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg p-lg shadow-xl w-[320px]">
            <p className="text-body mb-md">
              确定要删除标签「{allTags.find((t) => t.id === deletingId)?.name || ''}」吗？已关联该标签的实验将解绑。
            </p>
            <div className="flex justify-end gap-sm">
              <button type="button" onClick={() => setDeletingId(null)} className="btn-ghost">
                取消
              </button>
              <button type="button" onClick={confirmDelete} className="btn-danger">
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
