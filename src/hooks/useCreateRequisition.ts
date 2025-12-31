
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

type RequisitionItem = {
  productId: number;
  productName: string;
  quantity: number;
};

type CreateRequisitionParams = {
  sucursal: string;
  solicitante: string;
  puesto: string;
  items: RequisitionItem[];
  userId: string;
};

export function useCreateRequisition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sucursal, solicitante, puesto, items, userId }: CreateRequisitionParams) => {
      // 1. Create Requisition Header
      const { data: reqData, error: reqError } = await supabase
        .from('requisiciones')
        .insert({
           sucursal,
           solicitante, // Name
           puesto,
           created_by: userId,
           status: 'pending' // Assuming 'pending' is a valid status, need to verify or use default
        })
        .select()
        .single();

      if (reqError) throw reqError;

      const requisitionId = reqData.id;

      // 2. Create Requisition Items
      const itemsToInsert = items.map(item => ({
        requisicion_id: requisitionId,
        producto_id: item.productId,
        cantidad: item.quantity,
        // product_name? If the table stores it. 
        // Checking schema: requisicion_detalles has: id, requisicion_id, producto_id, cantidad. 
        // It does NOT seem to have product_name based on step 16 output for 'requisicion_detalles'.
        // Wait, step 16 output for 'requisicion_detalles': id, requisicion_id, producto_id, cantidad, created_at.
        // So no product name. Good.
      }));

      const { error: itemsError } = await supabase
        .from('requisicion_detalles')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return reqData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
    },
  });
}
