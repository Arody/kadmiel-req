
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useUserRole } from './useUserRole';

export type StockItem = {
  id: string; // uuid of stock entry (or constructed)
  product_id: number;
  sucursal: string;
  quantity: number;
  updated_at?: string;
  productos?: any; 
};

export function useStock() {
  const { data: role } = useUserRole();
  const queryClient = useQueryClient();

  // Fetch Stock: Now fetches PRODUCTS + Linked Stock
  const query = useQuery({
    queryKey: ['stock', role?.sucursal],
    queryFn: async () => {
      if (!role?.sucursal) return [];

      // 1. Get All Active Products
      const { data: products, error: prodError } = await supabase
        .from('productos')
        .select('*')
        .eq('is_active', true);

      if (prodError) throw prodError;

      // 2. Get Stock for this Branch
      const { data: stock, error: stockError } = await supabase
        .from('branch_stock')
        .select('*')
        .eq('sucursal', role.sucursal);

      if (stockError) throw stockError;

      // 3. Merge
      // If a product has no stock record, we create a virtual one with qty 0
      const merged: StockItem[] = products.map((p) => {
         const stockEntry = stock.find((s) => s.product_id === p.id);
         return {
            id: stockEntry?.id || `virtual-${p.id}`,
            product_id: p.id,
            sucursal: role.sucursal!,
            quantity: stockEntry?.quantity || 0,
            updated_at: stockEntry?.updated_at,
            productos: p // Pass full product object
         };
      });

      return merged;
    },
    enabled: !!role?.sucursal,
  });

  // Update Stock
  const updateStock = useMutation({
    mutationFn: async ({ id, product_id, quantity }: { id: string, product_id: number, quantity: number }) => {
       if (!role?.sucursal) throw new Error("No Branch Selected");

       // If id starts with 'virtual', it means we need to INSERT
       if (id.startsWith('virtual')) {
          const { error } = await supabase
            .from('branch_stock')
            .insert({
                product_id,
                sucursal: role.sucursal,
                quantity,
                updated_at: new Date().toISOString()
            });
          if (error) throw error;
       } else {
          // UPDATE
          const { error } = await supabase
            .from('branch_stock')
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) throw error;
       }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });

  return { ...query, updateStock };
}
