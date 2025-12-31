
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useSession } from './useSession';
import { useUserRole } from './useUserRole';

export type Requisition = {
  id: number; // BigInt
  folio: string;
  sucursal: string;
  solicitante: string;
  puesto: string;
  status: string;
  created_at: string;
};

export function useRequisitions() {
  const { session } = useSession();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['requisitions', role?.sucursal, role?.role],
    queryFn: async () => {
      if (!session?.user.id || !role) return [];

      let query = supabase
        .from('requisiciones')
        .select('*')
        .order('created_at', { ascending: false });

      // Build filters based on role
      if (role.role === 'operative') {
        // Operatives see only their own? Or their branch's?
        // Prompt says: "Listado con filtros status".
        // Usually operative sees their branch.
        if (role.sucursal) {
           query = query.eq('sucursal', role.sucursal);
        }
      } else if (role.role === 'branch_admin') {
        if (role.sucursal) {
           query = query.eq('sucursal', role.sucursal);
        }
      }
      // Super admin sees all

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching requisitions:', error);
        return [];
      }
      return data as Requisition[];
    },
    enabled: !!session?.user.id && !!role,
  });
}
