
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export type Campaign = {
  id: number;
  title: string;
  is_active: boolean;
};

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, title, is_active')
        .order('id', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    }
  });
}
