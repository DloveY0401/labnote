import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ExperimentList from './pages/ExperimentList';
import ExperimentEdit from './pages/ExperimentEdit';
import ProjectManager from './pages/ProjectManager';
import ProjectDetail from './pages/ProjectDetail';
import TemplateManager from './pages/TemplateManager';
import ReagentLibrary from './pages/ReagentLibrary';
import SchedulePage from './pages/SchedulePage';
import WidgetPage from './pages/WidgetPage';

const StructureDraw = lazy(() => import('./pages/StructureDraw'));

// Full-screen wrapper for the structure editor (no sidebar, no padding)
function StructureLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <main className="flex-1 overflow-hidden bg-white">
        <Suspense fallback={<div className="flex items-center justify-center h-full"><p className="text-gray-400">加载中...</p></div>}>
          <StructureDraw />
        </Suspense>
      </main>
    </div>
  );
}

// Wide layout for Schedule page (sidebar + full-width content)
function ScheduleLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-gray-50">
        <div className="p-lg h-full">
          <SchedulePage />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ExperimentList />} />
        <Route path="/experiments/new" element={<ExperimentEdit />} />
        <Route path="/experiments/:id" element={<ExperimentEdit />} />
        <Route path="/projects" element={<ProjectManager />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/templates" element={<TemplateManager />} />
        <Route path="/reagents" element={<ReagentLibrary />} />
      </Route>
      {/* Schedule needs full width with sidebar */}
      <Route path="/schedule" element={<ScheduleLayout />} />
      {/* Widget — frameless, no sidebar, dark background */}
      <Route path="/widget" element={<WidgetPage />} />
      {/* Structure editor needs full screen, separate from Layout */}
      <Route path="/structure" element={<StructureLayout />} />
    </Routes>
  );
}
