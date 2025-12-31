
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useProfile } from '../../hooks/useProfile';
import { useUserRole } from '../../hooks/useUserRole';
import { supabase } from '../../lib/supabaseClient';
import { 

  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  LogOut, 
  Store,
  Menu
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { useState } from 'react';
import { Button } from '../ui/button';

export function AppShell() {
  const { session } = useSession();
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Nueva Orden', href: '/pos', icon: ShoppingCart },
    { name: 'Mis Órdenes', href: '/orders', icon: Package },
  ];

  if (userRole?.role === 'branch_admin' || userRole?.role === 'super_admin') {
    navItems.push({ name: 'Inventario', href: '/stock', icon: Store });
  }

  // navItems.push({ name: 'Configuración', href: '/settings', icon: Settings });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-sm transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center px-6 border-b border-gray-100">
           <span className="text-xl font-bold text-gray-900 tracking-tight">Kadmiel</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group",
                  isActive 
                    ? "bg-gray-900 text-white" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0",
                  isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"
                )} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-100 p-4">
           <div className="flex items-center mb-4 px-2">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                 {profile?.full_name?.charAt(0) || session?.user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name || 'Usuario'}</p>
                <p className="text-xs text-gray-500 truncate">{userRole?.sucursal || 'Sin Sucursal'}</p>
              </div>
           </div>
           <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleSignOut}>
             <LogOut className="mr-2 h-4 w-4" />
             Cerrar Sesión
           </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar (Mobile only mostly, or global search) */}
        <header className="lg:hidden flex h-16 items-center border-b border-gray-200 bg-white px-4 shadow-sm">
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-4 font-semibold text-gray-900">Kadmiel Órdenes</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
           <Outlet />
        </main>
      </div>
    </div>
  );
}
