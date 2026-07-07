import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import StructureImage, { isSmilesLike } from '../components/StructureImage';
import ConfirmDialog from '../components/ConfirmDialog';
import { Experiment, Project, Tag } from '../types';
import { getExperiments, getProjects, getTags, getAllExperimentTags, deleteExperiment } from '../db/queries';
import { useToast, ToastContainer } from '../components/Toast';

export default function ExperimentList() {
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [expTagMap, setExpTagMap] = useState<Map<number, number[]>>(new Map());

  // Filters
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tagId, setTagId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; title: string } | null>(null);

  const loadData = async () => {
    try {
      const [exps, projs, tgs, allExpTags] = await Promise.all([
        getExperiments(),
        getProjects(),
        getTags('experiment'),
        getAllExperimentTags(),
      ]);
      setExperiments(exps);
      setProjects(projs);
      setTags(tgs);
      const map = new Map<number, number[]>();
      allExpTags.forEach(({ experiment_id, tag_id }) => {
        const arr = map.get(experiment_id);
        if (arr) arr.push(tag_id);
        else map.set(experiment_id, [tag_id]);
      });
      setExpTagMap(map);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return experiments.filter((exp) => {
      if (search) {
        const q = search.toLowerCase();
        if (!exp.title.toLowerCase().includes(q) && !(exp.project_name || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (tagId) {
        const tags = expTagMap.get(exp.id) || [];
        if (!tags.includes(Number(tagId))) return false;
      }
      if (projectId && String(exp.project_id) !== projectId) return false;
      if (dateFrom && exp.date < dateFrom) return false;
      if (dateTo && exp.date > dateTo) return false;
      return true;
    });
  }, [experiments, search, projectId, tagId, dateFrom, dateTo]);

  const handleDelete = async (id: number, title: string) => {
    setPendingDelete({ id, title });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExperiment(pendingDelete.id);
      setExperiments((prev) => prev.filter((e) => e.id !== pendingDelete.id));
    } catch (err) {
      showToast('删除失败: ' + String(err), 'error');
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-lg">
        <h1 className="text-h1">全部实验</h1>
        <span className="text-caption text-gray-400">{experiments.length} 条记录</span>
      </div>

      {/* Filter bar */}
      <FilterBar
        search={search} onSearchChange={setSearch}
        projectId={projectId} onProjectChange={setProjectId}
        tagId={tagId} onTagChange={setTagId}
        dateFrom={dateFrom} onDateFromChange={setDateFrom}
        dateTo={dateTo} onDateToChange={setDateTo}
        projects={projects} tags={tags}
      />

      {/* Empty state */}
      {experiments.length === 0 ? (
        <div className="card p-2xl text-center">
          <div className="text-gray-300 mb-md">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-md">还没有实验记录，点击 + 新建开始吧</p>
          <button onClick={() => navigate('/experiments/new')} className="btn-primary">
            新建实验
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-2xl text-center">
          <p className="text-gray-500">没有匹配的实验，试试调整筛选条件</p>
        </div>
      ) : (
        /* Experiment table */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-sm px-lg text-caption text-gray-400 font-medium">标题</th>
                <th className="text-left py-sm px-lg text-caption text-gray-400 font-medium w-[110px]">日期</th>
                <th className="text-left py-sm px-lg text-caption text-gray-400 font-medium w-[140px]">标签</th>
                <th className="text-left py-sm px-lg text-caption text-gray-400 font-medium w-[120px]">课题</th>
                <th className="text-left py-sm px-lg text-caption text-gray-400 font-medium w-[100px]">结构式</th>
                <th className="text-right py-sm px-lg text-caption text-gray-400 font-medium w-[100px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr
                  key={exp.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/experiments/${exp.id}`)}
                >
                  <td className="py-sm px-lg">
                    <div>
                      <span className="text-body font-medium text-gray-900 hover:text-primary-500 transition-colors">
                        {exp.title}
                      </span>
                      {exp.subtitle && (
                        <p className="text-caption text-gray-400 mt-0.5">{exp.subtitle}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-sm px-lg text-body text-gray-500">{exp.date}</td>
                  <td className="py-sm px-lg">
                    {(() => {
                      const tagIds = expTagMap.get(exp.id) || [];
                      if (tagIds.length === 0) return <span className="text-gray-400 text-caption">—</span>;
                      const matchedTags = tags.filter(t => tagIds.includes(t.id));
                      return (
                        <div className="flex flex-wrap gap-xs">
                          {matchedTags.map(tag => (
                            <span
                              key={tag.id}
                              className="inline-block px-xs py-0.5 rounded-sm text-[11px] font-medium"
                              style={{ backgroundColor: tag.color + '20', color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-sm px-lg">
                    {exp.project_name ? (
                      <span className="inline-block px-sm py-xs rounded-sm bg-primary-50 text-primary-700 text-caption">
                        {exp.project_name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-caption">—</span>
                    )}
                  </td>
                  <td className="py-sm px-lg" onClick={(e) => e.stopPropagation()}>
                    {exp.structure_image && isSmilesLike(exp.structure_image) ? (
                      <StructureImage
                        smiles={exp.structure_image}
                        width={80}
                        height={60}
                        hoverZoom
                      />
                    ) : (
                      <span className="text-gray-400 text-caption">—</span>
                    )}
                  </td>
                  <td className="py-sm px-lg text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/experiments/${exp.id}`);
                      }}
                      className="btn-ghost mr-xs"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(exp.id, exp.title);
                      }}
                      className="btn-ghost text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ConfirmDialog
        open={confirmOpen}
        title="删除实验"
        message={pendingDelete ? `确定删除实验「${pendingDelete.title}」？此操作不可撤销。` : ''}
        danger
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
}
