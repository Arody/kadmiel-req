
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useSession } from './useSession';
import { useUserRole } from './useUserRole';

export type Order = {
  id: string; // UUID
  folio: number;
  customer_name: string;
  customer_phone?: string;
  sucursal: string;
  delivery_date?: string;
  delivery_time?: string;
  delivery_type: 'pickup' | 'delivery';
  delivery_address?: string;
  status: 'pending' | 'paid' | 'delivered' | 'cancelled';
  payment_method?: string;
  payment_status: string; // 'pending' | 'paid' | 'abono'
  paid_amount: number;
  total: number;
  created_at: string;
  created_by: string; // UUID
  creator_name?: string; // Virtual field for display
  notes?: string;
};

export function useOrders() {
  const { session } = useSession();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['orders', role?.sucursal, role?.role],
    queryFn: async () => {
      console.log('Fetching orders. Role:', role);
      if (!session?.user.id || !role) {
          console.warn('No session or role found', { session: !!session?.user.id, role });
          return [];
      }

      let query = supabase
        .from('ordenes_compra')
        .select('*')
        .order('created_at', { ascending: false });

      if (role.role === 'operative' || role.role === 'branch_admin') {
        if (role.sucursal) {
           console.log('Filtering by sucursal:', role.sucursal);
           query = query.eq('sucursal', role.sucursal);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        return [];
      }
      
      console.log('Orders fetched:', data?.length);
      return data as Order[];
    },
    enabled: !!session?.user.id && !!role, // Wait for both session and role
  });
}
