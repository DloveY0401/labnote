import { type DragEvent, useState } from 'react';

interface SectionHeaderProps {
  title: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  canHide?: boolean;
  onHide?: () => void;
  dragHandle?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  draggable?: boolean;
}

export default function SectionHeader({
  title,
  collapsed = false,
  onToggleCollapse,
  canHide = false,
  onHide,
  dragHandle = false,
  onDragStart,
  onDragOver,
  onDrop,
  draggable = false,
}: SectionHeaderProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
    onDragOver?.(e);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent) => {
    setDragOver(false);
    onDrop?.(e);
  };

  return (
    <div
      className={`flex items-center gap-sm mb-md select-none transition-colors rounded ${dragOver ? 'bg-primary-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragHandle && (
        <div
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-xs shrink-0"
          draggable="true"
          onDragStart={onDragStart}
          onMouseDown={(e) => { e.currentTarget.draggable = true; }}
          title="拖拽排序"
        >
          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}

      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-xs text-left hover:text-primary-600 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="section-title mb-0">{title}</h2>
        </button>
      ) : (
        <h2 className="section-title mb-0">{title}</h2>
      )}

      <div className="flex-1" />

      {canHide && onHide && (
        <button
          type="button"
          onClick={onHide}
          className="text-gray-400 hover:text-red-500 transition-colors p-xs"
          title="隐藏此模块"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
