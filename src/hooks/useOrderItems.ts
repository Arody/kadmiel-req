
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useOrderItems() {
  const queryClient = useQueryClient();

  const addItem = useMutation({
    mutationFn: async ({ orderId, productId, quantity, price }: { orderId: string, productId: number, quantity: number, price: number }) => {
        // 1. Insert item
        const { error } = await supabase.from('orden_compra_detalles').insert({
            order_id: orderId,
            product_id: productId,
            cantidad: quantity,
            precio_unitario: price
        });
        if (error) throw error;
        
        // 2. Recalculate Total
        await updateOrderTotal(orderId);
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
    }
  });

  const updateItem = useMutation({
      mutationFn: async ({ itemId, quantity, orderId }: { itemId: string, quantity: number, orderId: string }) => {
         const { error } = await supabase.from('orden_compra_detalles')
            .update({ cantidad: quantity })
            .eq('id', itemId);
         if (error) throw error;
         
         await updateOrderTotal(orderId);
      },
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] })
  });

  const deleteItem = useMutation({
      mutationFn: async ({ itemId, orderId }: { itemId: string, orderId: string }) => {
          const { error } = await supabase.from('orden_compra_detalles').delete().eq('id', itemId);
          if (error) throw error;
          
          await updateOrderTotal(orderId);
      },
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] })
  });
  
  return { addItem, updateItem, deleteItem };
}

// Helper to recalculate total
async function updateOrderTotal(orderId: string) {
    // Fetch all items to sum up
    const { data: items } = await supabase.from('orden_compra_detalles').select('cantidad, precio_unitario').eq('order_id', orderId);
    
    // If no items, total is 0
    const newTotal = items ? items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0) : 0;
    
    await supabase.from('ordenes_compra').update({ total: newTotal }).eq('id', orderId);
}
