
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Order } from './useOrders';

export function useRecalculateTotals(orders: Order[] | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const recalculate = async () => {
      // 1. Get IDs of loaded orders
      const orderIds = orders.map(o => o.id);

      // 2. Fetch all details for these orders in one go
      const { data: details, error } = await supabase
        .from('orden_compra_detalles')
        .select('order_id, cantidad, precio_unitario')
        .in('order_id', orderIds);

      if (error || !details) {
        console.error('Error fetching details for recalculation:', error);
        return;
      }

      // 3. Calculate Real Totals in Memory
      const realTotals: Record<string, number> = {};
      
      // Initialize all to 0 first (in case an order has no details)
      orderIds.forEach(id => realTotals[id] = 0);

      details.forEach((d: any) => {
        const subtotal = (d.cantidad || 0) * (d.precio_unitario || 0);
        if (realTotals[d.order_id] !== undefined) {
            realTotals[d.order_id] += subtotal;
        }
      });

      // 4. Identify Differences and Batch Updates
      const updates = [];
      let updateCount = 0;

      for (const order of orders) {
        const calculatedTotal = realTotals[order.id];
        // Compare with tolerance for floating point
        if (Math.abs(order.total - calculatedTotal) > 0.01) {
          console.log(`Correcting Order #${order.folio}: stored ${order.total} vs calculated ${calculatedTotal}`);
          
          updates.push(
            supabase
              .from('ordenes_compra')
              .update({ total: calculatedTotal })
              .eq('id', order.id)
          );
          updateCount++;
        }
      }

      // 5. Execute Updates
      if (updateCount > 0) {
        await Promise.all(updates);
        console.log(`Recalculated and updated totals for ${updateCount} orders.`);
        // Invalidate to refresh UI with new totals
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        // console.log('All order totals are correct.');
      }
    };

    // Execute with a small delay to not block rendering
    const timer = setTimeout(() => {
        recalculate();
    }, 1000);

    return () => clearTimeout(timer);

  }, [orders, queryClient]); // Depend on orders: refreshing orders will re-trigger, but stable if no changes.
}
