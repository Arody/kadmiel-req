
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export type Product = {
  id: number; // BigInt
  nombre: string;
  descripcion: string;
  empaque: string; // unit similar
  precio: number;
  imagen_url: string;
  is_active: boolean;
  categoria: string;
  subcategoria: string;
};

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      let query = supabase
        .from('productos')
        .select('*')
        .eq('is_active', true)
        .order('nombre', { ascending: true })
        .limit(1000); // Pagination in proper app

      if (search) {
        query = query.ilike('nombre', `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      return data as Product[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
