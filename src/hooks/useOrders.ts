
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

export type UseOrdersParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string; // 'all' | 'pending' | ...
  paymentStatus?: string; // 'all' | 'paid' | ...
  fromDate?: string;
  toDate?: string;
};

export function useOrders(params: UseOrdersParams = {}) {
  const { session } = useSession();
  const { data: role } = useUserRole();
  const { page = 1, pageSize = 10, search = '', status = 'all', paymentStatus = 'all', fromDate, toDate } = params;

  return useQuery({
    queryKey: ['orders', role?.sucursal, role?.role, page, pageSize, search, status, paymentStatus, fromDate, toDate],
    queryFn: async () => {
      // console.log('Fetching orders. Role:', role, 'Params:', params);
      if (!session?.user.id || !role) {
        // console.warn('No session or role found', { session: !!session?.user.id, role });
        return { data: [], count: 0 };
      }

      let query = supabase
        .from('ordenes_compra')
        .select('*', { count: 'exact' });

      // 1. Search (Case insensitive partial match)
      if (search) {
        const isNumeric = !isNaN(Number(search));
        if (isNumeric) {
          // If number, search folio or exact total or phone
          query = query.or(`folio.eq.${search},customer_phone.ilike.%${search}%,total.eq.${search}`);
        } else {
          // If text, search name
          query = query.ilike('customer_name', `%${search}%`);
        }
      }

      // 2. Filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (paymentStatus && paymentStatus !== 'all') {
        query = query.eq('payment_status', paymentStatus);
      }

      // Date Filters
      if (fromDate) {
        query = query.gte('delivery_date', fromDate);
      }
      if (toDate) {
        query = query.lte('delivery_date', toDate);
      }

      // 3. Role restrictions (optional, if needed in future)
      // if (role.role === 'operative' && role.sucursal) {
      //    query = query.eq('sucursal', role.sucursal);
      // }

      // 4. Sorting & Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }
      
      return { data: data as Order[], count: count || 0 };
    },
    enabled: !!session?.user.id && !!role,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new
  });
}
