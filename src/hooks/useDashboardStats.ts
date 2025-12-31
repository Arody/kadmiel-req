
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useUserRole } from './useUserRole';

export function useDashboardStats() {
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['dashboard_stats', role?.sucursal],
    queryFn: async () => {
      if (!role?.sucursal) return null;

      // 1. Fetch Orders (for Sales Total & Stock Usage)
      // Filter by sucursal
      const { data: orders, error: ordersError } = await supabase
        .from('ordenes_compra')
        .select(`
          id,
          total,
          status,
          created_at,
          items:orden_compra_detalles (
            product_id,
            cantidad
          )
        `)
        .eq('sucursal', role.sucursal)
        .neq('status', 'cancelled'); // Exclude cancelled from sales/usage

      if (ordersError) throw ordersError;

      // 2. Fetch Stock (Base Inventory)
      // We also need product names for display
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
      if (!orders || !stock) return { totalSales: 0, stockOverview: [] };

      // Total Sales
      const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);

      // Stock Logic
      // Map: ProductID -> Sold Quantity
      const soldMap = new Map<number, number>();
      orders.forEach(order => {
         // @ts-ignore
         order.items?.forEach((item: any) => {
             const pid = item.product_id;
             const qty = item.cantidad || 0;
             soldMap.set(pid, (soldMap.get(pid) || 0) + qty);
         });
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
          stockOverview
      };
    },
    enabled: !!role?.sucursal
  });
}
