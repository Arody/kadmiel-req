
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../hooks/useSession';
import { useProfile } from '../../hooks/useProfile';
import { useUserRole } from '../../hooks/useUserRole';
import { useStock } from '../../hooks/useStock';
import {
  addSpecialClientOrderChange,
  clearSpecialClientOrderSidebarBadge,
  syncSpecialClientOrderSidebarBadgeIds,
  useSpecialClientOrderLogDiffs,
  useSpecialClientOrders,
  useSpecialClientOrderSidebarBadgeCount,
} from '../../hooks/useSpecialClientOrders';
import { supabase } from '../../lib/supabaseClient';
import {
  BellRing,
  LayoutDashboard,
  ShoppingCart,
  Package,
  LogOut,
  Store,
  Menu,
  Cake,
  type LucideIcon
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';

export function AppShell() {
  const { session } = useSession();
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();
  const { data: stock } = useStock();
  const { data: pendingSpecialOrders = [], isFetched: pendingSpecialOrdersFetched } = useSpecialClientOrders('pending');
  const pendingSpecialOrderIds = pendingSpecialOrders.map((order) => order.id);
  const {
    data: pendingSpecialOrderLogDiffs = {},
    isFetched: pendingSpecialOrderLogDiffsFetched,
  } = useSpecialClientOrderLogDiffs(pendingSpecialOrderIds);
  const specialOrderBadgeCount = useSpecialClientOrderSidebarBadgeCount();
  const queryClient = useQueryClient();
  const location = useLocation();
  const previousPendingOrderIds = useRef<string[] | null>(null);
  const previousPendingOrderSignatures = useRef<Record<string, string> | null>(null);
  const previousPendingOrderLogDiffSignatures = useRef<Record<string, string> | null>(null);
  const titleBlinkInterval = useRef<number | null>(null);
  const titleBeforeAlert = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientOrderFlash, setClientOrderFlash] = useState(false);

  // Calculate low stock items (<= 3)
  const lowStockCount = stock?.filter(item => item.quantity <= 3).length || 0;
  const canViewClientOrders = userRole?.role === 'branch_admin' || userRole?.role === 'super_admin';

  const stopTabTitleAlert = useCallback(() => {
    if (titleBlinkInterval.current) {
      window.clearInterval(titleBlinkInterval.current);
      titleBlinkInterval.current = null;
    }

    if (titleBeforeAlert.current) {
      document.title = titleBeforeAlert.current;
      titleBeforeAlert.current = null;
    }
  }, []);

  const startTabTitleAlert = useCallback(() => {
    if (!document.hidden || titleBlinkInterval.current) return;

    titleBeforeAlert.current = titleBeforeAlert.current || document.title;
    let showAlert = true;
    document.title = '🔴 PEDIDO NUEVO';

    titleBlinkInterval.current = window.setInterval(() => {
      showAlert = !showAlert;
      document.title = showAlert ? '🔴 PEDIDO NUEVO' : titleBeforeAlert.current || 'Kadmiel';
    }, 700);
  }, []);

  useEffect(() => {
    if (!canViewClientOrders) return;

    type RealtimePayload = { new: unknown; old: unknown; eventType?: string };

    const getPayloadRow = (payload: RealtimePayload) => {
      const row = payload.new && typeof payload.new === 'object' ? payload.new : payload.old;
      return row && typeof row === 'object' ? row as Record<string, unknown> : null;
    };

    const getPayloadField = (payload: RealtimePayload, field: string) => {
      const row = getPayloadRow(payload);
      if (!row || typeof row !== 'object') return null;

      const value = row[field];
      return typeof value === 'string' || typeof value === 'number' ? value : null;
    };

    const invalidateClientOrderQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['specialClientOrders'] });
      queryClient.invalidateQueries({ queryKey: ['specialClientOrderLogDiffs'] });
    };

    const notifyNewClientOrder = (orderId: string | number | null, payload?: RealtimePayload) => {
      if (orderId == null) return;

      const row = payload ? getPayloadRow(payload) : null;
      const actor = row?.last_actor || row?.requested_by_email || null;
      const changedAt = row?.updated_at || row?.reviewed_at || row?.created_at || new Date().toISOString();

      addSpecialClientOrderChange(orderId, {
        header: true,
        actor: typeof actor === 'string' ? actor : null,
        changedAt: String(changedAt),
      });
      setClientOrderFlash(true);
      startTabTitleAlert();
    };

    const channel = supabase
      .channel('client-requisitions-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_requisitions' },
        (payload) => {
          invalidateClientOrderQueries();
          if (payload.eventType === 'INSERT') {
            notifyNewClientOrder(getPayloadField(payload, 'id'), payload);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_requisition_items' },
        () => invalidateClientOrderQueries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canViewClientOrders, queryClient, startTabTitleAlert]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) stopTabTitleAlert();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTabTitleAlert();
    };
  }, [stopTabTitleAlert]);

  useEffect(() => {
    if (location.pathname === '/pedidos-clientes-especiales' && specialOrderBadgeCount > 0) {
      clearSpecialClientOrderSidebarBadge();
    }
  }, [location.pathname, specialOrderBadgeCount]);

  useEffect(() => {
    if (!canViewClientOrders || !pendingSpecialOrdersFetched) return;

    const pendingIds = pendingSpecialOrders.map((order) => String(order.id));
    const pendingSignatures = Object.fromEntries(
      pendingSpecialOrders.map((order) => [String(order.id), JSON.stringify({
        needed_at: order.needed_at,
        notes: order.notes,
        cargo: order.cargo,
        familia_farrera: order.familia_farrera,
        items: (order.client_requisition_items || [])
          .map((item) => ({
            product_id: String(item.product_id),
            quantity: item.quantity,
            notes: item.notes || item.note || '',
          }))
          .sort((a, b) => a.product_id.localeCompare(b.product_id)),
      })])
    );
    syncSpecialClientOrderSidebarBadgeIds(pendingIds);

    const previousIds = previousPendingOrderIds.current;
    if (!previousIds) {
      previousPendingOrderIds.current = pendingIds;
      previousPendingOrderSignatures.current = pendingSignatures;
      return;
    }

    const previousSignatures = previousPendingOrderSignatures.current || {};
    const newIds = pendingIds.filter((id) => !previousIds.includes(id));
    const updatedIds = pendingIds.filter((id) => previousIds.includes(id) && previousSignatures[id] !== pendingSignatures[id]);
    if (newIds.length > 0 || updatedIds.length > 0) {
      newIds.forEach((id) => addSpecialClientOrderChange(id, { header: true }));
      updatedIds.forEach((id) => {
        const order = pendingSpecialOrders.find((pendingOrder) => String(pendingOrder.id) === id);

        addSpecialClientOrderChange(id, {
          header: true,
          actor: order?.last_actor || order?.requested_by_email || null,
          changedAt: order?.updated_at || order?.reviewed_at || order?.created_at || new Date().toISOString(),
        });
      });
      setClientOrderFlash(true);
      startTabTitleAlert();
    }

    previousPendingOrderIds.current = pendingIds;
    previousPendingOrderSignatures.current = pendingSignatures;
  }, [canViewClientOrders, pendingSpecialOrders, pendingSpecialOrdersFetched, startTabTitleAlert]);

  useEffect(() => {
    if (!canViewClientOrders || !pendingSpecialOrderLogDiffsFetched) return;

    const diffSignatures = Object.fromEntries(
      Object.entries(pendingSpecialOrderLogDiffs).map(([id, diff]) => [id, JSON.stringify(diff)])
    );
    const previousDiffSignatures = previousPendingOrderLogDiffSignatures.current;

    if (!previousDiffSignatures) {
      previousPendingOrderLogDiffSignatures.current = diffSignatures;
      return;
    }

    const updatedDiffIds = Object.entries(diffSignatures)
      .filter(([id, signature]) => previousDiffSignatures[id] !== signature)
      .map(([id]) => id);

    if (updatedDiffIds.length > 0) {
      updatedDiffIds.forEach((id) => {
        const diff = pendingSpecialOrderLogDiffs[id];
        addSpecialClientOrderChange(id, {
          header: diff.headerDiffs.length > 0,
          productsChanged: diff.productDiffs.length > 0,
          actor: diff.actor || null,
          changedAt: diff.changedAt || new Date().toISOString(),
        });
      });
      setClientOrderFlash(true);
      startTabTitleAlert();
    }

    previousPendingOrderLogDiffSignatures.current = diffSignatures;
  }, [canViewClientOrders, pendingSpecialOrderLogDiffs, pendingSpecialOrderLogDiffsFetched, startTabTitleAlert]);

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  type NavItem = {
    name: string;
    href: string;
    icon: LucideIcon;
    badge?: number;
  };

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Nueva Orden', href: '/pos', icon: ShoppingCart },
    { name: 'Mis Órdenes', href: '/orders', icon: Package },
    { name: 'Cotizador', href: '/cotizador', icon: Cake },
  ];

  if (canViewClientOrders) {
    navItems.push({
      name: 'Pedidos clientes especiales',
      href: '/pedidos-clientes-especiales',
      icon: BellRing,
      badge: specialOrderBadgeCount > 0 ? specialOrderBadgeCount : undefined
    });

    navItems.push({
      name: 'Inventario',
      href: '/stock',
      icon: Store,
      badge: lowStockCount > 0 ? lowStockCount : undefined
    });
  }

  // navItems.push({ name: 'Configuración', href: '/settings', icon: Settings });

  return (
    <div className="flex h-screen bg-gray-50">
      {clientOrderFlash && (
        <button
          type="button"
          className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-red-700/45 text-white ring-8 ring-inset ring-red-500/80 backdrop-blur-[1px]"
          onClick={() => {
            setClientOrderFlash(false);
            stopTabTitleAlert();
          }}
        >
          <span className="relative rounded-2xl bg-red-700 px-8 py-6 text-center shadow-2xl ring-4 ring-white/80 animate-pulse">
            <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white shadow-lg" />
            <span className="block text-3xl font-black tracking-wide">PEDIDO NUEVO</span>
            <span className="mt-2 block text-sm font-semibold uppercase tracking-[0.25em] text-red-100">
              Cliente especial
            </span>
            <span className="mt-4 block text-xs text-red-100">Clic para cerrar alerta</span>
          </span>
        </button>
      )}

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
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group justify-between",
                  isActive 
                    ? "bg-gray-900 text-white" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <div className="flex items-center">
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"
                  )} />
                  {item.name}
                </div>
                {item.badge && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
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
