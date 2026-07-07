import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-xl max-w-[1100px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
