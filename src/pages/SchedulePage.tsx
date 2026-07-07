import { useEffect, useState, useMemo, useCallback } from 'react';
import Calendar, { type CalendarEvent } from '../components/Calendar';
import TaskItem from '../components/TaskItem';
import TaskForm from '../components/TaskForm';
import { useToast, ToastContainer } from '../components/Toast';
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from '../types';
import type { Experiment, Tag } from '../types';
import { getTasks, createTask, updateTask, deleteTask } from '../db/queries';
import { getExperiments, getTags, getAllExperimentTags } from '../db/queries';
import { useNavigate } from 'react-router-dom';

export default function SchedulePage() {
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [expTags, setExpTags] = useState<Tag[]>([]);
  const [expTagLinks, setExpTagLinks] = useState<{ experiment_id: number; tag_id: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todo');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [detailOpen, setDetailOpen] = useState(false);

  // Date range filter
  const [dateRange, setDateRange] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const getDateRangeDates = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from = '';
    let to = '';

    switch (dateRange) {
      case 'week': {
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        from = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        to = sunday.toISOString().slice(0, 10);
        break;
      }
      case 'month': {
        from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
        break;
      }
      case '30days': {
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        from = d.toISOString().slice(0, 10);
        to = today.toISOString().slice(0, 10);
        break;
      }
      case 'custom':
        from = dateFrom;
        to = dateTo;
        break;
      default:
        return null;
    }
    return { from, to };
  }, [dateRange, dateFrom, dateTo]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultExpId, setDefaultExpId] = useState<number | null>(null);
  const [parentTaskId, setParentTaskId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [t, exps, tg, eTags, eLinks] = await Promise.all([
        getTasks(), getExperiments(), getTags('task'), getTags('experiment'), getAllExperimentTags(),
      ]);
      setTasks(t);
      setExperiments(exps);
      setAllTags(tg);
      setExpTags(eTags);
      setExpTagLinks(eLinks);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter tasks - exclude subtasks
  const filteredTasks = useMemo(() => {
    const range = getDateRangeDates();
    return tasks.filter(t => {
      if (t.parent_task_id) return false;
      if (statusFilter && statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (selectedDate && t.due_date !== selectedDate) return false;
      if (selectedTag && !t.tags.some(tg => String(tg.id) === selectedTag)) return false;
      if (range) {
        if (!t.due_date) return false;
        if (t.due_date < range.from || t.due_date > range.to) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, selectedDate, selectedTag, getDateRangeDates]);

  const experimentTagsMap = useMemo(() => {
    const map = new Map<number, Tag[]>();
    for (const link of expTagLinks) {
      const tag = expTags.find(t => t.id === link.tag_id);
      if (!tag) continue;
      const arr = map.get(link.experiment_id) || [];
      arr.push(tag);
      map.set(link.experiment_id, arr);
    }
    return map;
  }, [expTags, expTagLinks]);

  // Calendar events - only parent tasks
  const calendarEvents = useMemo(() => {
    const evs: CalendarEvent[] = [];

    for (const task of tasks) {
      if (task.due_date && !task.parent_task_id) {
        evs.push({
          date: task.due_date,
          title: task.title,
          type: 'task',
          id: task.id,
          priority: task.priority,
          description: task.description || '',
          status: task.status === 'todo' ? '待办' : task.status === 'in_progress' ? '进行中' : task.status === 'done' ? '已完成' : '已取消',
          dueDate: task.due_date,
        });
      }
    }

    for (const exp of experiments) {
      if (exp.date) {
        evs.push({
          date: exp.date,
          title: exp.title,
          type: 'experiment',
          id: exp.id,
          description: exp.subtitle || `实验编号 #${exp.id}`,
          experimentDate: exp.date,
        });
      }
    }

    return evs;
  }, [tasks, experiments]);

  // Date detail data
  const dateDetail = useMemo(() => {
    if (!selectedDate) return { tasks: [], experiments: [] };
    return {
      tasks: tasks.filter(t => t.due_date === selectedDate && !t.parent_task_id),
      experiments: experiments.filter(e => e.date === selectedDate),
    };
  }, [selectedDate, tasks, experiments]);

  const handleStatusChange = async (id: number, status: TaskStatus) => {
    try {
      await updateTask(id, { status });
      await loadData();
    } catch (err) {
      showToast('更新失败: ' + String(err), 'error');
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDefaultExpId(task.experiment_id);
    setParentTaskId(null);
    setFormOpen(true);
  };

  const handleAddSubtask = (parentId: number) => {
    setEditingTask(null);
    setDefaultExpId(null);
    setParentTaskId(parentId);
    setFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      showToast('删除失败: ' + String(err), 'error');
    }
  };

  const handleSave = async (data: CreateTaskInput) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data as UpdateTaskInput);
      } else {
        await createTask(data);
      }
      setFormOpen(false);
      setEditingTask(null);
      setParentTaskId(null);
      await loadData();
    } catch (err) {
      showToast('保存失败: ' + String(err), 'error');
    }
  };

  const handleCalendarDateClick = (date: string) => {
    if (selectedDate === date && detailOpen) {
      setDetailOpen(false);
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
      setDetailOpen(true);
    }
  };

  const handleCalendarEventClick = (ev: CalendarEvent) => {
    if (ev.type === 'task') {
      const task = tasks.find(t => t.id === ev.id);
      if (task) handleEdit(task);
    } else if (ev.type === 'experiment') {
      navigate(`/experiments/${ev.id}`);
    }
  };

  const handleTaskMove = async (taskId: number, newDate: string) => {
    try {
      await updateTask(taskId, { due_date: newDate });
      await loadData();
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">加载中...</p></div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-lg">
        <h1 className="text-h1">日程</h1>
        <button onClick={() => { setEditingTask(null); setParentTaskId(null); setFormOpen(true); }} className="btn-primary text-sm">
          + 新建任务
        </button>
      </div>

      <div className="flex-1 flex gap-lg min-h-0 overflow-hidden">
        {/* Left: Task List - width increased 1.5x */}
        <div className="w-[540px] flex-shrink-0 flex flex-col min-h-0">
          {/* Filters */}
          <div className="flex items-center gap-sm mb-md flex-wrap">
            {[
              { key: 'all', label: '全部' },
              { key: 'todo', label: '待办' },
              { key: 'done', label: '已完成' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`text-xs px-sm py-1 rounded-full border transition-colors ${
                  statusFilter === f.key
                    ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
            {selectedDate && (
              <button
                onClick={() => { setSelectedDate(null); setDetailOpen(false); }}
                className="text-xs px-sm py-1 rounded-full border border-primary-300 bg-primary-50 text-primary-700"
              >
                {selectedDate} ✕
              </button>
            )}
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-sm mb-md flex-wrap">
            {[
              { key: 'all', label: '全部时间' },
              { key: 'week', label: '本周' },
              { key: 'month', label: '本月' },
              { key: '30days', label: '近30天' },
              { key: 'custom', label: '自定义' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setDateRange(f.key)}
                className={`text-xs px-sm py-1 rounded-full border transition-colors ${
                  dateRange === f.key
                    ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-1">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="input text-xs py-1 px-2 w-[130px]" />
                <span className="text-xs text-gray-400">—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="input text-xs py-1 px-2 w-[130px]" />
              </div>
            )}
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1 mb-md flex-wrap">
              <span className="text-[11px] text-gray-400 mr-1">标签:</span>
              <button onClick={() => setSelectedTag('')}
                className={`text-[11px] px-2 py-0.5 rounded-full border ${!selectedTag ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                全部
              </button>
              {allTags.map(tag => (
                <button key={tag.id} onClick={() => setSelectedTag(prev => prev === String(tag.id) ? '' : String(tag.id))}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    selectedTag === String(tag.id) ? 'border-transparent text-white' : 'border-gray-200 text-gray-600'
                  }`}
                  style={selectedTag === String(tag.id) ? { backgroundColor: tag.color } : {}}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {/* Task list */}
          <div className="flex-1 overflow-y-auto">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-xl text-gray-400 text-sm">
                {statusFilter === 'done' ? '没有已完成的任务' : '没有待办任务'}
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddSubtask={handleAddSubtask}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Calendar - fills full height */}
        <div className="flex-1 min-w-0 h-full">
          <div className="card p-lg h-full flex flex-col">
            <Calendar
              events={calendarEvents}
              onDateClick={handleCalendarDateClick}
              onEventClick={handleCalendarEventClick}
              selectedDate={selectedDate}
              onTaskMove={handleTaskMove}
            />
          </div>
        </div>
      </div>

      {/* Date Detail Panel */}
      {detailOpen && selectedDate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-lg p-xl max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-body font-semibold">{selectedDate} 日程</h3>
              <button onClick={() => setDetailOpen(false)} className="btn-ghost text-sm">✕</button>
            </div>

            {dateDetail.tasks.length === 0 && dateDetail.experiments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-md">当天没有日程</p>
            ) : (
              <div className="space-y-md">
                {dateDetail.tasks.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-400 uppercase tracking-wide mb-sm">任务</h4>
                    <div className="space-y-xs">
                      {dateDetail.tasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => { setDetailOpen(false); handleEdit(task); }}
                          className="p-sm border border-gray-200 rounded-md hover:border-primary-400 cursor-pointer"
                        >
                          <div className="flex items-center gap-sm">
                            <span className={`w-2 h-2 rounded-full ${
                              task.priority === 'urgent' ? 'bg-red-500' :
                              task.priority === 'high' ? 'bg-orange-400' :
                              task.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-300'
                            }`} />
                            <span className="text-sm font-medium">{task.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {task.status === 'todo' ? '待办' : task.status === 'in_progress' ? '进行中' : task.status === 'done' ? '已完成' : '已取消'}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dateDetail.experiments.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gray-400 uppercase tracking-wide mb-sm">实验</h4>
                    <div className="space-y-xs">
                      {dateDetail.experiments.map(exp => (
                        <div
                          key={exp.id}
                          onClick={() => { setDetailOpen(false); navigate(`/experiments/${exp.id}`); }}
                          className="p-sm border border-gray-200 rounded-md hover:border-blue-400 cursor-pointer"
                        >
                          <div className="flex items-center gap-sm">
                            <span className="text-sm font-medium text-blue-700">{exp.title}</span>
                            {exp.project_name && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{exp.project_name}</span>
                            )}
                          </div>
                          {exp.subtitle && (
                            <p className="text-xs text-gray-500 mt-1">{exp.subtitle}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-lg flex justify-end">
              <button onClick={() => setDetailOpen(false)} className="btn-ghost">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        open={formOpen}
        task={editingTask}
        experiments={experiments}
        allTags={allTags}
        experimentTagsMap={experimentTagsMap}
        defaultExperimentId={defaultExpId}
        parentTaskId={parentTaskId}
        onSave={handleSave}
        onCancel={() => { setFormOpen(false); setEditingTask(null); setParentTaskId(null); }}
        onTagsRefresh={loadData}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
