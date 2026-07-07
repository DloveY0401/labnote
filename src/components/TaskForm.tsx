import { useEffect, useRef, useState } from 'react';
import type { Task, CreateTaskInput, TaskStatus, TaskPriority } from '../types';
import type { Experiment, Tag } from '../types';
import { createTag, deleteTag, updateTag } from '../db/queries';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c',
];

interface TaskFormProps {
  open: boolean;
  task?: Task | null;
  experiments: Experiment[];
  allTags: Tag[];
  experimentTagsMap?: Map<number, Tag[]>;
  defaultExperimentId?: number | null;
  parentTaskId?: number | null;
  onSave: (data: CreateTaskInput) => void;
  onCancel: () => void;
  onTagsRefresh?: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'done', label: '已完成' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
];

const RECURRENCE_OPTIONS = [
  { value: '', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'every 2 weeks', label: '每两周' },
  { value: 'monthly', label: '每月' },
];

const todayStr = new Date().toISOString().slice(0, 10);

export default function TaskForm({ open, task, experiments, allTags, experimentTagsMap, defaultExperimentId, parentTaskId, onSave, onCancel, onTagsRefresh }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(todayStr);
  const [experimentId, setExperimentId] = useState<number | ''>('');
  const [recurrence, setRecurrence] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  // Experiment selector
  const [expDropdownOpen, setExpDropdownOpen] = useState(false);
  const [expSearch, setExpSearch] = useState('');
  const expSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expDropdownOpen) return;
    const handleDocClick = (e: MouseEvent) => {
      if (expSelectorRef.current && !expSelectorRef.current.contains(e.target as Node)) {
        setExpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [expDropdownOpen]);

  // Tag management
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [deletingTagId, setDeletingTagId] = useState<number | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date || '');
      setExperimentId(task.experiment_id ?? '');
      setRecurrence(task.recurrence_rule || '');
      setSelectedTagIds(task.tags ? task.tags.map(t => t.id) : []);
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setDueDate(todayStr);
      setExperimentId(defaultExperimentId ?? '');
      setRecurrence('');
      setSelectedTagIds([]);
    }
    setExpDropdownOpen(false);
    setExpSearch('');
  }, [task, open, defaultExperimentId]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      due_date: dueDate || null,
      experiment_id: experimentId ? Number(experimentId) : null,
      parent_task_id: parentTaskId || null,
      recurrence_rule: recurrence || undefined,
      tag_ids: selectedTagIds,
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      await createTag({ name, color: newTagColor, type: 'task' });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowTagInput(false);
      onTagsRefresh?.();
    } catch { /* tag may already exist */ }
  };

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const saveEditTag = async () => {
    if (!editTagName.trim() || editingTagId === null) return;
    try {
      await updateTag(editingTagId, { name: editTagName.trim(), color: editTagColor });
      setEditingTagId(null);
      onTagsRefresh?.();
    } catch { /* handle silently */ }
  };

  const confirmDeleteTag = async () => {
    if (deletingTagId === null) return;
    try {
      await deleteTag(deletingTagId);
      setSelectedTagIds(prev => prev.filter(id => id !== deletingTagId));
      setDeletingTagId(null);
      onTagsRefresh?.();
    } catch { /* handle silently */ }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-lg mx-lg max-h-[85vh] overflow-y-auto">
        <div className="p-xl">
          <h3 className="text-body font-semibold mb-lg">{task ? '编辑任务' : '新建任务'}</h3>

          {/* Title */}
          <div className="mb-md">
            <label className="block text-xs text-gray-500 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input w-full"
              placeholder="任务标题"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Description */}
          <div className="mb-md">
            <label className="block text-xs text-gray-500 mb-1">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="可选"
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-md mb-md">
            <div>
              <label className="block text-xs text-gray-500 mb-1">优先级</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="input w-full">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">状态</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className="input w-full">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Due date + Recurrence */}
          <div className="grid grid-cols-2 gap-md mb-md">
            <div>
              <label className="block text-xs text-gray-500 mb-1">截止日期</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">重复</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className="input w-full">
                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Experiment */}
          <div className="mb-md relative" ref={expSelectorRef}>
            <label className="block text-xs text-gray-500 mb-1">关联实验</label>
            <button
              type="button"
              onClick={() => setExpDropdownOpen(o => !o)}
              className="input w-full text-left flex items-center justify-between"
            >
              {experimentId ? (() => {
                const exp = experiments.find(e => e.id === experimentId);
                return exp ? <span>{exp.title} <span className="text-gray-400 text-xs">{exp.date}</span></span> : <span>已关联</span>;
              })() : <span className="text-gray-400">不关联</span>}
              <span className="text-gray-400 text-xs">{expDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {expDropdownOpen && (
              <div className="absolute z-[11000] left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[320px] flex flex-col">
                <div className="p-sm border-b border-gray-100">
                  <input
                    type="text"
                    value={expSearch}
                    onChange={e => setExpSearch(e.target.value)}
                    placeholder="搜索实验标题、小标题..."
                    className="input w-full text-xs py-1.5"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  <button
                    type="button"
                    onClick={() => { setExperimentId(''); setExpDropdownOpen(false); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs mb-1 ${experimentId === '' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-600'}`}
                  >
                    不关联
                  </button>
                  {experiments
                    .filter(exp => {
                      if (!expSearch.trim()) return true;
                      const q = expSearch.trim().toLowerCase();
                      const tags = experimentTagsMap?.get(exp.id) || [];
                      return (exp.title?.toLowerCase().includes(q) ||
                              exp.subtitle?.toLowerCase().includes(q) ||
                              exp.date.includes(q) ||
                              tags.some(t => t.name.toLowerCase().includes(q)));
                    })
                    .map(exp => {
                      const tags = experimentTagsMap?.get(exp.id) || [];
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => { setExperimentId(exp.id); setExpDropdownOpen(false); }}
                          className={`w-full text-left px-2 py-2 rounded mb-1 border ${experimentId === exp.id ? 'border-primary-500 bg-primary-50' : 'border-transparent hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm text-gray-900 truncate flex-1">{exp.title}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{exp.date}</span>
                          </div>
                          {exp.subtitle && (
                            <div className="text-[11px] text-gray-500 truncate mt-0.5">{exp.subtitle}</div>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tags.map(t => (
                                <span key={t.id} className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: t.color + '20', color: t.color }}>
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Tags with management */}
          <div className="mb-lg">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">标签</label>
              <button
                type="button"
                onClick={() => setShowTagInput(!showTagInput)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + 新建标签
              </button>
            </div>

            {/* Create new tag */}
            {showTagInput && (
              <div className="flex items-center gap-xs mb-sm flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      newTagColor === c ? 'border-gray-700 scale-125' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <input
                  type="text"
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                  placeholder="标签名"
                  className="input text-xs py-1 px-2 w-[100px]"
                  autoFocus
                />
                <button type="button" onClick={handleCreateTag} className="btn-primary text-xs px-sm py-1">确认</button>
                <button type="button" onClick={() => { setShowTagInput(false); setNewTagName(''); }} className="btn-ghost text-xs px-sm py-1">取消</button>
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {allTags.map(tag => {
                const isEditing = editingTagId === tag.id;
                const selected = selectedTagIds.includes(tag.id);

                if (isEditing) {
                  return (
                    <div key={tag.id} className="flex items-center gap-xs px-2 py-1 rounded-md border border-primary-400 bg-white">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditTagColor(c)}
                          className={`w-4 h-4 rounded-full border-2 ${editTagColor === c ? 'border-gray-700' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input type="text" value={editTagName} onChange={e => setEditTagName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditTag(); if (e.key === 'Escape') setEditingTagId(null); }}
                        className="input text-xs py-0.5 px-1 w-[80px]" autoFocus />
                      <button type="button" onClick={saveEditTag} className="btn-primary text-[10px] px-1 py-0.5">保存</button>
                      <button type="button" onClick={() => setEditingTagId(null)} className="btn-ghost text-[10px] px-1 py-0.5">取消</button>
                    </div>
                  );
                }

                return (
                  <div key={tag.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        selected
                          ? 'border-transparent text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                      style={selected ? { backgroundColor: tag.color } : {}}
                    >
                      {tag.name}
                    </button>
                    {/* hover edit/delete */}
                    <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEditTag(tag); }}
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-500 hover:text-primary-600"
                        title="编辑"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingTagId(tag.id); }}
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-600"
                        title="删除"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {allTags.length === 0 && <span className="text-xs text-gray-400">暂无任务标签</span>}
            </div>
          </div>

          {/* Delete tag confirm */}
          {deletingTagId !== null && (
            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-lg p-lg shadow-xl w-[300px]">
                <p className="text-sm mb-md">确定删除标签「{allTags.find(t => t.id === deletingTagId)?.name}」？</p>
                <div className="flex justify-end gap-sm">
                  <button type="button" onClick={() => setDeletingTagId(null)} className="btn-ghost text-xs">取消</button>
                  <button type="button" onClick={confirmDeleteTag} className="btn-danger text-xs">删除</button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-sm">
            <button onClick={onCancel} className="btn-ghost">取消</button>
            <button onClick={handleSave} className="btn-primary" disabled={!title.trim()}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
