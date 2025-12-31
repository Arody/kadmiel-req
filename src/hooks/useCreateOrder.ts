
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { type Product } from './useProducts';

export type CreateOrderParams = {
  customer_name: string;
  customer_phone?: string;
  delivery_date?: string;
  delivery_time?: string;
  delivery_type: 'pickup' | 'delivery';
  delivery_address?: string;
  payment_method?: string;
  payment_status?: string;
  total: number;
  sucursal: string;
  created_by: string; // User ID
  notes?: string;
  items: {
    product: Product;
    quantity: number;
  }[];
};

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateOrderParams) => {
      // 1. Create Order Header
      const { data: order, error: orderError } = await supabase
        .from('ordenes_compra')
        .insert({
          customer_name: params.customer_name,
          customer_phone: params.customer_phone,
          sucursal: params.sucursal,
          delivery_date: params.delivery_date,
          delivery_time: params.delivery_time,
          delivery_type: params.delivery_type,
          delivery_address: params.delivery_address,
          payment_method: params.payment_method,
          payment_status: params.payment_status || 'pending',
          total: params.total,
          created_by: params.created_by,
          status: 'pending',
          notes: params.notes
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Details
      const itemsData = params.items.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        cantidad: item.quantity,
        precio_unitario: item.product.precio
      }));

      const { error: itemsError } = await supabase
        .from('orden_compra_detalles')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
