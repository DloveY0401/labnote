import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/', label: '全部实验', icon: 'experiment' },
  { to: '/schedule', label: '日程', icon: 'schedule' },
  { to: '/projects', label: '课题管理', icon: 'folder' },
  { to: '/templates', label: '模板库', icon: 'template' },
  { to: '/reagents', label: '试剂库', icon: 'reagent' },
  { to: '/structure', label: '结构式绘制', icon: 'structure' },
];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'experiment':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
    case 'folder':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case 'template':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'reagent':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      );
    case 'structure':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case 'schedule':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="w-[180px] bg-white border-r border-gray-200 flex flex-col select-none shrink-0">
      {/* Logo */}
      <div className="px-lg py-xl border-b border-gray-100">
        <h1 className="text-h1 text-primary-700 tracking-tight">LabNote</h1>
        <p className="text-caption text-gray-400 mt-xs">化学实验记录</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-sm">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-sm px-lg py-sm mx-sm rounded-md text-label transition-colors duration-150 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <NavIcon icon={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Widget toggle */}
      <div className="px-sm pb-sm border-t border-gray-100">
        <button
          onClick={() => window.labnote?.widget.toggle()}
          className="w-full flex items-center gap-sm px-lg py-sm rounded-md text-label text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
          title="显示/隐藏桌面小组件"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          桌面小组件
        </button>
      </div>

      {/* New experiment button */}
      <div className="p-sm border-t border-gray-100">
        <button
          onClick={() => navigate('/experiments/new')}
          className="btn-primary w-full flex items-center justify-center gap-sm text-label"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建实验
        </button>
      </div>
    </aside>
  );
}
