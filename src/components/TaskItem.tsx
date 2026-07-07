import { useState } from 'react';
import type { Task, TaskStatus } from '../types';

const STATUS_COLORS: Record<string, string> = {
  todo: 'text-blue-600 bg-blue-100',
  done: 'text-green-600 bg-green-100',
};

const STATUS_LABELS: Record<string, string> = {
  todo: '待办',
  done: '已完成',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-gray-300',
};

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onAddSubtask?: (parentId: number) => void;
}

function NextStatus(current: TaskStatus): TaskStatus | null {
  if (current === 'todo') return 'done';
  if (current === 'done') return 'todo';
  return null;
}

export default function TaskItem({ task, onStatusChange, onEdit, onDelete, onAddSubtask }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubtasks = (task.subtasks && task.subtasks.length > 0);
  const nextStatus = NextStatus(task.status);

  return (
    <div className={`group border rounded-lg p-sm mb-xs transition-colors ${
      task.status === 'done' ? 'opacity-60 border-gray-200' :
      task.priority === 'urgent' ? 'border-red-200 bg-red-50/30' :
      'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-start gap-sm">
        {/* Priority dot */}
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />

        {/* Status checkbox */}
        <button
          onClick={() => nextStatus && onStatusChange(task.id, nextStatus)}
          title={nextStatus ? `标记为 ${STATUS_LABELS[nextStatus]}` : ''}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            task.status === 'done'
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          {task.status === 'done' && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm">
            <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[task.status]}`}>
              {STATUS_LABELS[task.status]}
            </span>
          </div>

          <div className="flex items-center gap-sm mt-0.5 text-[11px] text-gray-500">
            {task.due_date && (
              <span>{task.due_date}</span>
            )}
            {task.experiment_id && (
              <span className="text-primary-600 font-medium">
                #{task.experiment_title || `exp-${task.experiment_id}`}
              </span>
            )}
            {hasSubtasks && (
              <span className="text-gray-400">
                {task.subtasks!.filter(s => s.status === 'done').length}/{task.subtasks!.length} 子任务
              </span>
            )}
            {task.recurrence_rule && (
              <span className="text-purple-500">⟳ {task.recurrence_rule}</span>
            )}
            {task.tags && task.tags.length > 0 && task.tags.map(tag => (
              <span key={tag.id} className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        </div>

        {/* Actions - always visible, larger icons */}
        <div className="flex items-center gap-xs flex-shrink-0">
          {hasSubtasks && (
            <button onClick={() => setExpanded(!expanded)} className="btn-ghost text-sm p-1.5" title="展开子任务">
              {expanded ? '▾' : '▸'}
            </button>
          )}
          {onAddSubtask && !task.parent_task_id && (
            <button onClick={() => onAddSubtask(task.id)} className="btn-ghost text-sm p-1.5" title="添加子任务">+</button>
          )}
          <button onClick={() => onEdit(task)} className="btn-ghost text-sm p-1.5" title="编辑">✎</button>
          <button onClick={() => onDelete(task.id)} className="btn-ghost text-sm p-1.5 text-red-500 hover:text-red-700" title="删除">✕</button>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="ml-8 mt-sm space-y-xs">
          {task.subtasks!.map(sub => (
            <TaskItem
              key={sub.id}
              task={sub}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
