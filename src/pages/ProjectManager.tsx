import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../types';
import { getProjects, createProject, updateProject, deleteProject } from '../db/queries';
import { useToast, ToastContainer } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ProjectManager() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const { toasts, showToast, removeToast } = useToast();

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    try {
      setProjects(await getProjects());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setEditingId(null);
    setShowNew(false);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    console.log('[LabNote] Creating project:', formName);
    setSaving(true);
    try {
      await createProject({ name: formName.trim(), description: formDesc.trim() || undefined });
      console.log('[LabNote] Project created successfully');
      resetForm();
      await loadProjects();
    } catch (err) {
      console.error('[LabNote] Create project failed:', err);
      showToast('创建失败: ' + String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormDesc(p.description || '');
    setShowNew(true);
  };

  const handleUpdate = async () => {
    if (!formName.trim() || editingId == null) return;
    setSaving(true);
    try {
      await updateProject(editingId, { name: formName.trim(), description: formDesc.trim() || undefined });
      resetForm();
      await loadProjects();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Project) => {
    setPendingDelete(p);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteProject(pendingDelete.id);
      await loadProjects();
    } catch (err) {
      showToast('删除失败: ' + String(err), 'error');
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">加载中...</p></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="text-h1">课题管理</h1>
        <button onClick={() => { resetForm(); setShowNew(true); }} className="btn-primary flex items-center gap-sm text-label">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建课题
        </button>
      </div>

      {/* New/Edit form */}
      {showNew && (
        <div className="card p-lg mb-lg">
          <h3 className="text-h2 mb-md">{editingId ? '编辑课题' : '新建课题'}</h3>
          <div className="flex gap-md items-end">
            <div className="flex-1">
              <label className="block text-caption text-gray-500 mb-xs">名称 *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如: 天然产物全合成"
                className="input-field"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && (editingId ? handleUpdate() : handleCreate())}
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-caption text-gray-500 mb-xs">描述</label>
              <input
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="简要描述课题目标..."
                className="input-field"
              />
            </div>
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={!formName.trim() || saving}
              className="btn-primary"
            >
              {saving ? '保存中...' : editingId ? '更新' : '创建'}
            </button>
            <button onClick={resetForm} className="btn-secondary">取消</button>
          </div>
        </div>
      )}

      {/* Project grid */}
      {projects.length === 0 ? (
        <div className="card p-2xl text-center">
          <div className="text-gray-300 mb-md">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-md">还没有课题，点击上方按钮创建一个</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-lg">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="card p-lg hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-sm">
                <div className="flex items-center gap-sm">
                  <h3 className="text-body font-semibold text-gray-900 hover:text-primary-600 transition-colors">{p.name}</h3>
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-sm rounded-full bg-primary-50 text-primary-700 text-caption font-semibold">
                    {p.experiment_count ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-xs" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => startEdit(p)} className="btn-ghost text-caption">编辑</button>
                  <button onClick={() => handleDelete(p)} className="btn-ghost text-red-500 text-caption">删除</button>
                </div>
              </div>
              {p.description && (
                <p className="text-caption text-gray-400 leading-relaxed">{p.description}</p>
              )}
              <p className="text-caption text-gray-300 mt-sm">创建于 {p.created_at}</p>
            </div>
          ))}
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ConfirmDialog
        open={confirmOpen}
        title="删除课题"
        message={pendingDelete ? `确定删除课题「${pendingDelete.name}」？该课题下的实验将取消关联。` : ''}
        danger
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
}
