import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Template } from '../types';
import { getTemplates, deleteTemplate } from '../db/queries';
import { useToast, ToastContainer } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function TemplateManager() {
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);

  const loadTemplates = async () => {
    try {
      setTemplates(await getTemplates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleDelete = async (t: Template) => {
    setPendingDelete(t);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTemplate(pendingDelete.id);
      setTemplates((prev) => prev.filter((x) => x.id !== pendingDelete.id));
    } catch (err) {
      showToast('删除失败: ' + String(err), 'error');
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const parsePreview = (data: string): string => {
    try {
      const obj = JSON.parse(data);
      const parts: string[] = [];
      if (obj.catalysts?.length) parts.push(`催化剂: ${obj.catalysts.map((c: any) => c.name).join(', ')}`);
      if (obj.solvents?.length) parts.push(`溶剂: ${obj.solvents.map((s: any) => s.name).join(', ')}`);
      if (obj.form?.temperature) parts.push(`温度: ${obj.form.temperature}`);
      if (obj.form?.atmosphere) parts.push(`气氛: ${obj.form.atmosphere}`);
      return parts.join(' · ') || '(空模板)';
    } catch {
      return '(数据异常)';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">加载中...</p></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h1 className="text-h1">模板库</h1>
        <button onClick={() => navigate('/experiments/new')} className="btn-primary flex items-center gap-sm text-label">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建空白实验
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="card p-2xl text-center">
          <div className="text-gray-300 mb-md">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-md">还没有实验模板</p>
          <p className="text-caption text-gray-400 mb-md">
            在编辑实验页面，点击"保存为模板"即可将当前实验条件保存为模板
          </p>
          <button onClick={() => navigate('/experiments/new')} className="btn-primary">
            新建实验
          </button>
        </div>
      ) : (
        <div className="space-y-md">
          {templates.map((t) => (
            <div key={t.id} className="card p-lg flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <h3 className="text-body font-semibold text-gray-900 mb-xs">{t.name}</h3>
                {t.description && (
                  <p className="text-caption text-gray-500 mb-xs">{t.description}</p>
                )}
                <p className="text-caption text-gray-400">{parsePreview(t.template_data)}</p>
              </div>

              <div className="flex items-center gap-lg ml-lg shrink-0">
                <div className="text-right">
                  <p className="text-caption text-gray-400">使用次数</p>
                  <p className="text-body font-semibold text-gray-700">{t.usage_count}</p>
                </div>
                <div className="text-right">
                  <p className="text-caption text-gray-400">更新于</p>
                  <p className="text-caption text-gray-500">{t.updated_at?.slice(0, 10)}</p>
                </div>
                <div className="flex items-center gap-xs">
                  <button
                    onClick={() => navigate(`/experiments/new?template=${t.id}`)}
                    className="btn-primary text-label"
                  >
                    使用
                  </button>
                  <button
                    onClick={() => navigate(`/experiments/new?template=${t.id}&edit_template=${t.id}`)}
                    className="btn-secondary text-label"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="btn-ghost text-red-500 text-caption"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ConfirmDialog
        open={confirmOpen}
        title="删除模板"
        message={pendingDelete ? `确定删除模板「${pendingDelete.name}」？` : ''}
        danger
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
}
