import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 lg:ml-0 mt-14 lg:mt-0 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
