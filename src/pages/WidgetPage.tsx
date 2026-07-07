import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Task, TaskStatus } from '../types';
import type { Experiment } from '../types';
import { getTasks, getExperiments, createTask, updateTask } from '../db/queries';
import { useNavigate } from 'react-router-dom';
import WidgetSettings, { loadWidgetPrefs, type WidgetPrefs } from '../components/WidgetSettings';

// Import bear decorations as URLs (Vite resolves them correctly in dev & prod)
import brownBearImg from '/widget-bears/brown-bear.png';
import whiteBearImg from '/widget-bears/white-bear.png';
import brownBearAltImg from '/widget-bears/brown-bear-alt.png';
import whiteBearAltImg from '/widget-bears/white-bear-alt.png';

const bearImages: Record<string, { brown: string; white: string }> = {
  default: { brown: brownBearImg, white: whiteBearImg },
  alt: { brown: brownBearAltImg, white: whiteBearAltImg },
};

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];

function MiniCalendar({ selectedDate, onDateClick }: { selectedDate: string; onDateClick: (date: string) => void }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const cells: JSX.Element[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - adjustedFirst + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dateStr = inMonth ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}` : '';
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;

    cells.push(
      <div key={i}
        onClick={() => inMonth ? onDateClick(dateStr) : undefined}
        className={`text-center py-0.5 text-[10px]
          ${!inMonth ? 'text-gray-600 cursor-default' : 'cursor-pointer'}
          ${isSelected ? '' : ''}`}>
        <span className={`inline-flex items-center justify-center rounded-full mx-auto
          ${!inMonth ? '' : isSelected ? 'bg-primary-500 text-white font-bold w-5 h-5' : isToday ? 'font-bold text-white bg-primary-500/40 w-5 h-5' : 'text-gray-200 hover:bg-white/10 w-5 h-5'}`}>
          {inMonth ? dayNum : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-md">
      <div className="flex items-center justify-between mb-1 px-1">
        <button onClick={prev} className="text-gray-400 hover:text-gray-200 text-[11px]">&lt;</button>
        <span className="text-gray-200 text-[11px]">{viewYear}年{viewMonth + 1}月</span>
        <button onClick={next} className="text-gray-400 hover:text-gray-200 text-[11px]">&gt;</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-[9px] text-gray-500 text-center">{d}</div>
        ))}
        {cells}
      </div>
    </div>
  );
}

export default function WidgetPage() {
  const navigateTo = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<WidgetPrefs>(loadWidgetPrefs);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [t, exps] = await Promise.all([getTasks(), getExperiments()]);
      setTasks(t);
      setExperiments(exps);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!window.labnote) return;
    const unsubData = window.labnote.widget.onDataChanged(() => loadData());
    return () => { unsubData(); };
  }, [loadData]);

  const activeDate = selectedDate || todayStr;
  const isToday = activeDate === todayStr;

  const todayTasks = useMemo(() =>
    tasks.filter(t => t.due_date === activeDate && !t.parent_task_id).filter(t => t.status !== 'done'),
    [tasks, activeDate]
  );

  const todayExperiments = useMemo(() =>
    experiments.filter(e => e.date === activeDate),
    [experiments, activeDate]
  );

  const handleToggle = async (task: Task) => {
    try {
      await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t));
    } catch { /* silent */ }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask({ title: newTitle.trim(), due_date: todayStr });
      setNewTitle('');
      setShowAdd(false);
      loadData();
    } catch { /* silent */ }
  };

  return (
    <div id="widget-root" className="h-full w-full text-gray-200 select-none overflow-hidden flex flex-col relative rounded-xl shadow-2xl"
      style={{ background: `rgba(18, 22, 33, ${prefs.opacity})` }}>
      <div className="h-8 flex items-center justify-center relative" style={{ WebkitAppRegion: isLocked ? 'no-drag' : 'drag' } as any}>
        <div className="w-8 h-1 rounded-full bg-white/20" />
        {/* Lock button */}
        <button
          onClick={() => setIsLocked(!isLocked)}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title={isLocked ? '解锁位置' : '锁定位置'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isLocked ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            )}
          </svg>
        </button>
        {/* Settings gear */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <div className="px-md pb-md overflow-y-auto flex-1" style={{ zoom: prefs.fontScale }}>
        {/* Mini Calendar */}
        <MiniCalendar selectedDate={activeDate} onDateClick={setSelectedDate} />

        {/* Today's experiments */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[11px] text-gray-500 uppercase tracking-wide">{isToday ? '今日实验' : `${activeDate.slice(5)} 实验`}</h3>
          {!isToday && (
            <button onClick={() => setSelectedDate(null)} className="text-[10px] text-primary-400 hover:text-primary-300">
              回到今天
            </button>
          )}
        </div>
        {todayExperiments.length > 0 && (
          <div className="mb-md">
            <div className="space-y-0.5">
              {todayExperiments.map(exp => (
                <div key={exp.id}
                  onClick={() => window.labnote?.widget.navigateTo(`/experiments/${exp.id}`)}
                  className="text-xs px-2 py-1 rounded bg-blue-500/15 text-blue-300 cursor-pointer hover:bg-blue-500/25 truncate">
                  {exp.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's tasks */}
        <div className="mb-md">
          <h3 className="text-[11px] text-gray-500 mb-1 uppercase tracking-wide">{isToday ? '今日待办' : '待办'}</h3>
          {todayTasks.length === 0 ? (
            <p className="text-[11px] text-gray-600">今天没有待办任务</p>
          ) : (
            <div className="space-y-0.5">
              {todayTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => handleToggle(task)}
                    className="w-3.5 h-3.5 rounded border border-gray-500 flex-shrink-0 flex items-center justify-center hover:border-green-400 transition-colors"
                  />
                  <span className="text-xs text-gray-300 truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick add */}
        {showAdd ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowAdd(false); setNewTitle(''); } }}
              placeholder="任务标题..."
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-white/40"
              autoFocus
            />
            <button onClick={handleAdd} className="text-xs px-2 py-1 rounded bg-primary-500/60 text-white hover:bg-primary-500/80">添加</button>
            <button onClick={() => { setShowAdd(false); setNewTitle(''); }} className="text-xs text-gray-500">取消</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 rounded border border-dashed border-white/10 hover:border-white/20 transition-colors">
            + 快速添加任务
          </button>
        )}

        {/* Open main app */}
        <button
          onClick={() => window.labnote?.widget.openMain()}
          className="w-full mt-md text-xs text-gray-500 hover:text-gray-300 py-1 rounded border border-white/10 hover:border-white/20 transition-colors">
          打开主界面
        </button>
      </div>

      {/* Decorative bears in top corners */}
      {prefs.bearEnabled && (
        <>
          {/* Top-left: brown bear */}
          <div
            className="absolute top-8 left-0 pointer-events-none overflow-hidden rounded-br-2xl"
            style={{
              opacity: prefs.bearOpacity,
              WebkitMaskImage: 'linear-gradient(to bottom right, black 30%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom right, black 30%, transparent 100%)',
            }}
          >
            <img
              src={bearImages[prefs.bearSet]?.brown || brownBearImg}
              alt=""
              style={{ width: prefs.bearSize, height: 'auto', display: 'block' }}
              draggable={false}
            />
          </div>
          {/* Top-right: white bear */}
          <div
            className="absolute top-8 right-0 pointer-events-none overflow-hidden rounded-bl-2xl"
            style={{
              opacity: prefs.bearOpacity,
              WebkitMaskImage: 'linear-gradient(to bottom left, black 30%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom left, black 30%, transparent 100%)',
            }}
          >
            <img
              src={bearImages[prefs.bearSet]?.white || whiteBearImg}
              alt=""
              style={{ width: prefs.bearSize, height: 'auto', display: 'block' }}
              draggable={false}
            />
          </div>
        </>
      )}

      {/* Settings panel */}
      <WidgetSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        prefs={prefs}
        onChange={setPrefs}
      />
    </div>
  );
}
