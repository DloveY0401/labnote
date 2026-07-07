import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../types';
import { getTasksByExperiment, updateTask } from '../db/queries';

interface LinkedTasksProps {
  experimentId: number;
}

export default function LinkedTasks({ experimentId }: LinkedTasksProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    getTasksByExperiment(experimentId).then(setTasks).catch(console.error);
  }, [experimentId]);

  if (tasks.length === 0) {
    return (
      <div className="card p-md mt-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-gray-700">关联任务</h3>
        </div>
        <p className="text-sm text-gray-400 mt-sm">
          暂无关联任务。
          <button onClick={() => navigate('/schedule')} className="text-primary-600 hover:text-primary-700 ml-1">
            前往日程页面新建
          </button>
        </p>
      </div>
    );
  }

  const handleToggle = async (task: Task) => {
    const nextMap: Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
    await updateTask(task.id, { status: nextMap[task.status] as any });
    const updated = await getTasksByExperiment(experimentId);
    setTasks(updated);
  };

  return (
    <div className="card p-md mt-lg">
      <div className="flex items-center justify-between mb-sm">
        <h3 className="text-body font-semibold text-gray-700">
          关联任务 ({tasks.length})
        </h3>
        <button onClick={() => navigate('/schedule')} className="btn-ghost text-xs">
          日程页面 →
        </button>
      </div>
      <div className="space-y-1">
        {tasks.map(task => (
          <div key={task.id} className={`flex items-center gap-sm py-1.5 px-sm rounded-md text-sm
            ${task.status === 'done' ? 'opacity-50' : ''}`}>
            <button
              onClick={() => handleToggle(task)}
              className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center
                ${task.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
            >
              {task.status === 'done' && (
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`flex-1 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {task.title}
            </span>
            {task.due_date && (
              <span className="text-xs text-gray-400">{task.due_date}</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded
              ${task.status === 'todo' ? 'bg-blue-100 text-blue-600' :
                task.status === 'in_progress' ? 'bg-amber-100 text-amber-600' :
                'bg-green-100 text-green-600'}`}>
              {task.status === 'todo' ? '待办' : task.status === 'in_progress' ? '进行中' : '已完成'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
