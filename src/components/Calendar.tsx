import { useMemo, useState, useRef } from 'react';

export interface CalendarEvent {
  date: string;
  title: string;
  type: 'task' | 'experiment';
  id: number;
  priority?: string;
  description?: string;
  status?: string;
  experimentDate?: string;
  dueDate?: string;
}

interface CalendarProps {
  events: CalendarEvent[];
  onDateClick?: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  selectedDate?: string | null;
  onTaskMove?: (taskId: number, newDate: string) => void;
}

const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function Calendar({ events, onDateClick, onEventClick, selectedDate, onTaskMove }: CalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) || [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const cells: JSX.Element[] = [];
  const totalCells = 42;

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

    let dateStr = '';
    if (inMonth) {
      dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    }

    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const dayEvents = inMonth ? (eventsByDate.get(dateStr) || []) : [];

    cells.push(
      <div
        key={i}
        className={`relative border border-gray-100 h-full min-h-[80px] p-1 cursor-pointer flex flex-col transition-colors
          ${inMonth ? 'hover:bg-gray-50' : 'bg-gray-50/50'}
          ${isSelected ? 'ring-2 ring-primary-400 bg-primary-50' : ''}
          ${inMonth && dragOverDate === dateStr ? 'bg-primary-100 border-primary-300' : ''}`}
        onClick={() => inMonth && onDateClick?.(dateStr)}
        onDragOver={(e) => {
          if (!inMonth || !onTaskMove) return;
          e.preventDefault();
        }}
        onDragEnter={() => {
          if (!inMonth || !onTaskMove) return;
          dragDepthRef.current++;
          if (dragDepthRef.current === 1) setDragOverDate(dateStr);
        }}
        onDragLeave={() => {
          dragDepthRef.current--;
          if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0;
            setDragOverDate(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepthRef.current = 0;
          setDragOverDate(null);
          if (!inMonth || !onTaskMove) return;
          const taskId = Number(e.dataTransfer.getData('text/task-id'));
          const taskType = e.dataTransfer.getData('text/task-type');
          if (taskId && taskType === 'task') {
            onTaskMove(taskId, dateStr);
          }
        }}
      >
        <div className={`text-[11px] px-1 pt-0.5 font-medium
          ${!inMonth ? 'text-gray-300' : isToday ? 'text-white' : 'text-gray-700'}`}>
          {isToday ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500">{dayNum}</span>
          ) : (
            dayNum || ''
          )}
        </div>
        <div className="flex-1 space-y-0.5 px-0.5 overflow-hidden">
          {dayEvents.map((ev) => (
            <div
              key={`${ev.type}-${ev.id}`}
              draggable={ev.type === 'task' && !!onTaskMove}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/task-id', String(ev.id));
                e.dataTransfer.setData('text/task-type', ev.type);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={(e) => { e.stopPropagation(); onEventClick?.(ev); }}
              onMouseEnter={(e) => {
                setHoveredEvent(ev);
                setTooltipPos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredEvent(null)}
              className={`text-[10px] leading-tight truncate px-1 py-0.5 rounded cursor-pointer
                ${ev.type === 'task'
                  ? ev.priority === 'urgent' || ev.priority === 'high'
                    ? 'bg-coral-100 text-coral-800'
                    : 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
                }`}
              title={ev.title}
            >
              {ev.title.length > 12 ? ev.title.slice(0, 12) + '...' : ev.title}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderTooltip = () => {
    if (!hoveredEvent) return null;
    const ev = hoveredEvent;
    return (
      <div
        className="fixed z-[200] bg-white rounded-md shadow-lg border border-gray-200 p-sm text-xs max-w-xs pointer-events-none"
        style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}
      >
        <div className={`font-medium mb-1 ${ev.type === 'experiment' ? 'text-blue-700' : 'text-gray-900'}`}>
          {ev.type === 'experiment' ? '实验' : '任务'} · {ev.title}
        </div>
        {ev.description && (
          <div className="text-gray-600 mb-1 whitespace-pre-wrap">{ev.description}</div>
        )}
        {ev.status && (
          <div className="text-gray-500">状态: {ev.status}</div>
        )}
        {ev.priority && (
          <div className="text-gray-500">优先级: {ev.priority}</div>
        )}
        {ev.dueDate && (
          <div className="text-gray-500">截止日期: {ev.dueDate}</div>
        )}
        {ev.experimentDate && (
          <div className="text-gray-500">实验日期: {ev.experimentDate}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-sm">
        <button onClick={prevMonth} className="btn-ghost text-sm px-sm">&lt;</button>
        <h3 className="text-body font-medium">{viewYear}年 {MONTH_NAMES[viewMonth]}</h3>
        <div className="flex gap-xs">
          <button onClick={goToday} className="btn-ghost text-xs">今天</button>
          <button onClick={nextMonth} className="btn-ghost text-sm px-sm">&gt;</button>
        </div>
      </div>

      <div className="grid grid-cols-7 flex-1">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] text-gray-400 py-1 font-medium">{d}</div>
        ))}
        {cells}
      </div>

      <div className="flex gap-md mt-sm text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100"></span> 任务</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-100"></span> 实验</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-coral-100"></span> 高优先级</span>
      </div>

      {renderTooltip()}
    </div>
  );
}
