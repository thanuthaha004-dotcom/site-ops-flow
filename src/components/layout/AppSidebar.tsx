import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CalendarDays, Truck, Users, Menu, X,
  ChevronRight, Flame, ClipboardCheck, Route, UserCog, Send, LogOut, ShieldCheck, ListChecks, MapPin,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const adminNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/schedule', label: 'Schedule', icon: CalendarDays },
  { path: '/fleet', label: 'Fleet', icon: Truck },
  { path: '/workforce', label: 'Workforce', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { path: '/trips', label: 'Trip Planning', icon: Route },
  { path: '/engineers', label: 'Engineers', icon: UserCog },
  { path: '/driver-approvals', label: 'User Approvals', icon: ShieldCheck },
];

const engineerNavItems = [
  { path: '/', label: 'Submit Trips', icon: Send },
  { path: '/my-requests', label: 'My Trip Requests', icon: ListChecks },
  { path: '/projects', label: 'My Projects', icon: FolderKanban },
];

const driverNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/my-trips', label: 'All Trips', icon: Route },
];

export default function AppSidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, role, profileName, roleLoading, signOut } = useAuth();

  const navItems = role === 'admin' ? adminNavItems : role === 'driver' ? driverNavItems : engineerNavItems;
  const displayName = profileName || user?.user_metadata?.full_name || user?.email || 'User';
  const displayRole = role || (roleLoading ? 'Loading...' : 'Engineer');
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const panelLabel = role === 'admin' ? 'Admin Panel' : role === 'driver' ? 'Driver Panel' : 'Engineer Panel';

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 industrial-gradient flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Flame className="h-6 w-6 text-accent" />
          <span className="font-bold text-lg">OpsCenter</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-primary-foreground p-1">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-foreground/40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 industrial-gradient flex flex-col transition-transform duration-300
          lg:translate-x-0 ${open ? 'translate-x-0 animate-slide-in' : '-translate-x-full'} lg:static lg:z-auto`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
          <Flame className="h-7 w-7 text-accent" />
          <div>
            <h1 className="font-bold text-lg text-primary-foreground tracking-tight">OpsCenter</h1>
            <p className="text-[11px] text-sidebar-muted leading-none">
              {panelLabel}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                  ${active
                    ? 'bg-sidebar-accent text-accent'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {active && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-foreground truncate">{displayName}</p>
              <p className="text-xs text-sidebar-muted capitalize">{displayRole}</p>
            </div>
            <button onClick={signOut} className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-muted hover:text-primary-foreground transition-colors" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
