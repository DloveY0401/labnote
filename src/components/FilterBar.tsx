import { Project, Tag } from '../types';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  projectId: string;
  onProjectChange: (v: string) => void;
  tagId: string;
  onTagChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  projects: Project[];
  tags: Tag[];
}

export default function FilterBar({
  search, onSearchChange,
  projectId, onProjectChange,
  tagId, onTagChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  projects, tags,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-sm mb-lg">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <svg className="absolute left-sm top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="搜索实验标题、反应物..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field pl-2xl"
        />
      </div>

      {/* Project filter */}
      <select
        value={projectId}
        onChange={(e) => onProjectChange(e.target.value)}
        className="select-field w-[140px]"
      >
        <option value="">全部课题</option>
        {projects.map((p) => (
          <option key={p.id} value={String(p.id)}>{p.name}</option>
        ))}
      </select>

      {/* Tag filter */}
      <select
        value={tagId}
        onChange={(e) => onTagChange(e.target.value)}
        className="select-field w-[130px]"
      >
        <option value="">全部标签</option>
        {tags.map((t) => (
          <option key={t.id} value={String(t.id)}>{t.name}</option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="input-field w-[140px]"
        title="起始日期"
      />
      <span className="text-gray-400 text-caption">—</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="input-field w-[140px]"
        title="结束日期"
      />
    </div>
  );
}
