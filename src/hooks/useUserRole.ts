
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useSession } from './useSession';

export type UserRole = {
  id: string;
  user_id: string;
  role: 'super_admin' | 'branch_admin' | 'operative' | 'app_user';
  sucursal: 'Teran' | 'San Cristobal' | 'Aeropuerto' | null;
  department: string | null;
};

export function useUserRole() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['userRole', session?.user.id],
    queryFn: async () => {
      if (!session?.user.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle(); // 'maybeSingle' because user might not have a role row yet

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }
      return data as UserRole;
    },
    enabled: !!session?.user.id,
  });
}
