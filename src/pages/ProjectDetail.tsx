import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project } from '../types';
import { getProject, updateProject, getExperiments } from '../db/queries';
import { useToast, ToastContainer } from '../components/Toast';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [experimentCount, setExperimentCount] = useState(0);

  // edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editInnovations, setEditInnovations] = useState('');
  const [editTasks, setEditTasks] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  const loadProject = async () => {
    try {
      const p = await getProject(projectId);
      if (!p) {
        navigate('/projects');
        return;
      }
      setProject(p);
      setEditName(p.name);
      setEditDesc(p.description || '');
      setEditInnovations(p.innovations || '');
      setEditTasks(p.tasks || '');
      setEditProgress(p.progress ?? 0);
      const exps = await getExperiments();
      setExperimentCount(exps.filter((e: any) => e.project_id === projectId).length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [id]);

  const startEdit = () => setEditing(true);

  const cancelEdit = () => {
    if (project) {
      setEditName(project.name);
      setEditDesc(project.description || '');
      setEditInnovations(project.innovations || '');
      setEditTasks(project.tasks || '');
      setEditProgress(project.progress ?? 0);
    }
    setEditing(false);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateProject(projectId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        innovations: editInnovations.trim(),
        tasks: editTasks.trim(),
        progress: editProgress,
      });
      await loadProject();
      setEditing(false);
      showToast('课题信息已更新', 'success');
    } catch (err) {
      showToast('保存失败: ' + String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!project) return null;

  const progressPercent = editing ? editProgress : (project.progress ?? 0);
  const clampedProgress = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-sm mb-lg">
        <button onClick={() => navigate('/projects')} className="btn-ghost p-xs">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-h1">{editing ? '编辑课题' : '课题详情'}</h1>
        <div className="ml-auto">
          {!editing ? (
            <button onClick={startEdit} className="btn-primary text-label px-lg">
              <svg className="w-4 h-4 inline mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              编辑
            </button>
          ) : (
            <div className="flex gap-sm">
              <button onClick={handleSave} disabled={!editName.trim() || saving} className="btn-primary text-label px-lg">
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={cancelEdit} className="btn-secondary text-label px-lg">取消</button>
            </div>
          )}
        </div>
      </div>

      {/* 完成进度 */}
      <div className="card p-lg mb-lg">
        <div className="flex items-center justify-between mb-sm">
          <h3 className="text-h2 mb-0">完成进度</h3>
          <span className="text-h2 font-mono text-primary-600">{clampedProgress}%</span>
        </div>
        {editing ? (
          <div className="flex items-center gap-md">
            <input
              type="range"
              min={0}
              max={100}
              value={editProgress}
              onChange={(e) => setEditProgress(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={editProgress}
              onChange={(e) => setEditProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="input-field w-[80px] text-center"
            />
          </div>
        ) : (
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${clampedProgress}%`,
                background: clampedProgress >= 100
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : clampedProgress >= 50
                    ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                    : 'linear-gradient(90deg, #f59e0b, #d97706)',
              }}
            />
          </div>
        )}
      </div>

      {/* 基本信息 */}
      <div className="card p-lg mb-lg">
        <h3 className="text-h2 mb-md">基本信息</h3>

        {editing ? (
          <div className="space-y-md">
            <div>
              <label className="block text-caption text-gray-500 mb-xs">课题名称 *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-field"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-caption text-gray-500 mb-xs">描述</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="input-field min-h-[80px]"
                rows={3}
                placeholder="简要描述课题背景与目标..."
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-sm mb-sm">
              <h4 className="text-body font-semibold text-gray-900 text-lg">{project.name}</h4>
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-sm rounded-full bg-primary-50 text-primary-700 text-caption font-semibold">
                {experimentCount}
              </span>
            </div>
            {project.description && (
              <p className="text-caption text-gray-500 leading-relaxed">{project.description}</p>
            )}
            {!project.description && (
              <p className="text-caption text-gray-300 italic">暂无描述</p>
            )}
          </div>
        )}
      </div>

      {/* 主要创新点 */}
      <div className="card p-lg mb-lg">
        <h3 className="text-h2 mb-md">主要创新点</h3>
        {editing ? (
          <textarea
            value={editInnovations}
            onChange={(e) => setEditInnovations(e.target.value)}
            className="input-field min-h-[120px]"
            rows={5}
            placeholder="描述课题的创新之处，可分条列出..."
          />
        ) : (
          <div>
            {project.innovations ? (
              <div className="text-caption text-gray-700 leading-relaxed whitespace-pre-wrap">{project.innovations}</div>
            ) : (
              <p className="text-caption text-gray-300 italic">暂无创新点记录</p>
            )}
          </div>
        )}
      </div>

      {/* 主要任务 */}
      <div className="card p-lg mb-lg">
        <h3 className="text-h2 mb-md">主要任务</h3>
        {editing ? (
          <textarea
            value={editTasks}
            onChange={(e) => setEditTasks(e.target.value)}
            className="input-field min-h-[120px]"
            rows={5}
            placeholder="列出课题的主要任务与时间节点，可分条列出..."
          />
        ) : (
          <div>
            {project.tasks ? (
              <div className="text-caption text-gray-700 leading-relaxed whitespace-pre-wrap">{project.tasks}</div>
            ) : (
              <p className="text-caption text-gray-300 italic">暂无任务记录</p>
            )}
          </div>
        )}
      </div>

      {/* 元信息 */}
      <div className="card p-lg mb-lg">
        <h3 className="text-h2 mb-md">其他信息</h3>
        <div className="grid grid-cols-2 gap-md">
          <div>
            <span className="text-caption text-gray-400">关联实验数</span>
            <p className="text-body font-semibold text-gray-900">{experimentCount}</p>
          </div>
          <div>
            <span className="text-caption text-gray-400">创建时间</span>
            <p className="text-body font-semibold text-gray-900">{project.created_at}</p>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
