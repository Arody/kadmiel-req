
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useSession } from './useSession';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role?: string; // We might merge role here if useful, but keeping separate for now
};

export function useProfile() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      if (!session?.user.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // Don't throw if just not found, maybe return null or partial
        return null; 
      }
      return data as Profile;
    },
    enabled: !!session?.user.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
