
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useUserRole } from './useUserRole';

export type DashboardStatsParams = {
  startDate?: string;
  endDate?: string;
};

export function useDashboardStats(params?: DashboardStatsParams) {
  const { data: role } = useUserRole();
  const { startDate, endDate } = params || {};

  return useQuery({
    queryKey: ['dashboard_stats', role?.sucursal, startDate, endDate],
    queryFn: async () => {
      if (!role?.sucursal) return null;

      // 1. Fetch Orders in Period (Sales, Collected, Cancelled)
      let query = supabase
        .from('ordenes_compra')
        .select(`
          id,
          total,
          status,
          paid_amount,
          payment_status,
          created_at,
          delivery_date,
          items:orden_compra_detalles (
            product_id,
            cantidad,
            productos (
              nombre,
              empaque
            )
          )
        `)
        .eq('sucursal', role.sucursal);

      if (startDate) {
        // Use created_at for reliable sales reporting
        query = query.gte('created_at', `${startDate} 00:00:00`);
      }
      if (endDate) {
        // Ensure we cover the full end day
        query = query.lte('created_at', `${endDate} 23:59:59`);
      }

      const { data: ordersInPeriod, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      // 2. Fetch GLOBAL Pending Orders (Receivables - No Date Filter)
      // We want everything that is NOT paid and NOT cancelled
      const { data: globalPendingOrders, error: pendingError } = await supabase
        .from('ordenes_compra')
        .select('total, paid_amount')
        .eq('sucursal', role.sucursal)
        .neq('status', 'cancelled')
        .neq('payment_status', 'paid');

      if (pendingError) throw pendingError;

      // 3. Fetch Stock (Base Inventory)
      const { data: stock, error: stockError } = await supabase
        .from('branch_stock')
        .select(`
            product_id,
            quantity,
            productos (
                id,
                nombre,
                empaque
            )
        `)
        .eq('sucursal', role.sucursal);

      if (stockError) throw stockError;

      // 4. Calculate Totals
      if (!ordersInPeriod || !stock) return {
        totalSales: 0,
        totalCollected: 0,
        totalPending: 0,
        totalCancelled: 0,
        stockOverview: []
      };

      let totalSales = 0;
      let totalCollected = 0; // Collected ON PERIOD orders
      let totalCancelled = 0;

      const soldMap = new Map<number, number>();

      // A. Process Period Orders
      ordersInPeriod?.forEach(order => {
        if (order.status === 'cancelled') {
          totalCancelled += (order.total || 0);
        } else {
          // Active Orders in Period
          totalSales += (order.total || 0);

          // Calculate Collected: 
          // If marked as PAID, trust the total (handles legacy 0 paid_amount).
          // Otherwise use partial paid_amount.
          if (order.payment_status === 'paid') {
            totalCollected += (order.total || 0);
          } else {
            totalCollected += (order.paid_amount || 0);
          }

          // Note: Pending is calculated globally now

          // Stock Usage
           // @ts-ignore
           order.items?.forEach((item: any) => {
             const pid = item.product_id;
             const qty = item.cantidad || 0;
             soldMap.set(pid, (soldMap.get(pid) || 0) + qty);
           });
         }
      });

      // B. Process Global Receivables
      const totalPending = globalPendingOrders?.reduce((sum, order) => {
        // If explicitly paid, debt is 0 (double check against filter, but safer)
        // The filter .neq('payment_status', 'paid') handles it, but let's be robust
        const debt = (order.total || 0) - (order.paid_amount || 0);
        return sum + Math.max(0, debt);
      }, 0) || 0;


      // Build Overview
      const stockOverview = stock?.map(s => {
          const sold = soldMap.get(s.product_id) || 0;
          return {
              productName: Array.isArray(s.productos) ? s.productos[0]?.nombre : (s.productos as any)?.nombre,
              unit: Array.isArray(s.productos) ? s.productos[0]?.empaque : (s.productos as any)?.empaque,
              initialStock: s.quantity,
              sold: sold,
              remaining: s.quantity - sold
          };
      }) || [];

      return {
          totalSales,
        totalCollected,
        totalPending,
        totalCancelled,
        stockOverview,
        ordersInPeriod // Return raw orders for PDF report
      };
    },
    enabled: !!role?.sucursal
  });
}

