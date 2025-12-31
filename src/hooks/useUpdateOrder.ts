
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export type UpdateOrderParams = {
  id: string;
  status?: string;
  payment_status?: string;
  paid_amount?: number;
  notes?: string;
};

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, payment_status, paid_amount, notes }: UpdateOrderParams) => {
      const updates: any = {};
      if (status) updates.status = status;
      if (payment_status) updates.payment_status = payment_status;
      if (paid_amount !== undefined) updates.paid_amount = paid_amount;
      if (notes !== undefined) updates.notes = notes;

      const { data, error } = await supabase
        .from('ordenes_compra')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
