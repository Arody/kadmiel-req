import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export type Payment = {
  id: string;
  order_id: string;
  amount: number;
  notes?: string;
  created_at: string;
  created_by: string;
  creator_name?: string;
};

export function useOrderPayments(orderId: string) {
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['orderPayments', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orden_pagos')
        .select(`
            *,
            profiles:created_by (full_name)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map((Payment: any) => ({
          ...Payment,
          creator_name: Payment.profiles?.full_name || 'Desconocido'
      })) as Payment[];
    },
    enabled: !!orderId,
  });

  const addPayment = useMutation({
    mutationFn: async ({ orderId, amount, notes }: { orderId: string, amount: number, notes?: string }) => {
        // 1. Insert Payment
        const { error: insertError } = await supabase
            .from('orden_pagos')
            .insert({ order_id: orderId, amount, notes });
        
        if (insertError) throw insertError;

        // 2. Fetch current order total paid (or calculate from payments, but updating cache is faster)
        // We will increment the parent order's paid_amount atomically using an RPC or just fetching/updating
        // For now, let's just use the previous logic of updating the order header for the UI cache
        // Actually, let's recalculate total from DB to be safe, or just atomic increment if Supabase supports it easily.
        // We'll stick to: Get current -> Add -> Update.
        
        // Better: let's just invalidate the order query and let it re-fetch the total from a computed view? 
        // No, we are storing paid_amount in ordenes_compra. We need to update it.
        
        // Let's use an rpc? No, simple update is fine for now.
        const { data: order } = await supabase.from('ordenes_compra').select('paid_amount').eq('id', orderId).single();
        const newTotal = (order?.paid_amount || 0) + amount;
        
        await supabase.from('ordenes_compra').update({ paid_amount: newTotal }).eq('id', orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderPayments', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    payments,
    isLoading,
    addPayment
  };
}
