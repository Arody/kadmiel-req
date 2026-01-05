
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

      // 1. Fetch Orders (All statuses to calculate Cancelled too)
      let query = supabase
        .from('ordenes_compra')
        .select(`
          id,
          total,
          status,
          paid_amount,
          created_at,
          delivery_date,
          items:orden_compra_detalles (
            product_id,
            cantidad
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

      const { data: orders, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      // 2. Fetch Stock (Base Inventory)
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

      // 3. Calculate Totals
      if (!orders || !stock) return {
        totalSales: 0,
        totalCollected: 0,
        totalPending: 0,
        totalCancelled: 0,
        stockOverview: []
      };

      let totalSales = 0;
      let totalCollected = 0;
      let totalPending = 0;
      let totalCancelled = 0;

      const soldMap = new Map<number, number>();

      orders.forEach(order => {
        // Stats Calculation
        if (order.status === 'cancelled') {
          totalCancelled += (order.total || 0);
        } else {
          // Active Orders
          totalSales += (order.total || 0);
          totalCollected += (order.paid_amount || 0);
          const pending = (order.total || 0) - (order.paid_amount || 0);
          totalPending += Math.max(0, pending); // Ensure no negative pending

        // Stock Usage (Only active orders count against stock)
           // @ts-ignore
           order.items?.forEach((item: any) => {
             const pid = item.product_id;
             const qty = item.cantidad || 0;
             soldMap.set(pid, (soldMap.get(pid) || 0) + qty);
           });
         }
      });

      // Build Overview
      const stockOverview = stock.map(s => {
          const sold = soldMap.get(s.product_id) || 0;
          return {
              productName: Array.isArray(s.productos) ? s.productos[0]?.nombre : (s.productos as any)?.nombre,
              unit: Array.isArray(s.productos) ? s.productos[0]?.empaque : (s.productos as any)?.empaque,
              initialStock: s.quantity,
              sold: sold,
              remaining: s.quantity - sold
          };
      });

      return {
          totalSales,
        totalCollected,
        totalPending,
        totalCancelled,
          stockOverview
      };
    },
    enabled: !!role?.sucursal
  });
}
