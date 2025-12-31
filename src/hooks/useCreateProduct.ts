
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import imageCompression from 'browser-image-compression';

export type CreateProductParams = {
  nombre: string;
  precio: number;
  empaque: string; 
  descripcion?: string;
  catalogo?: string;
  categoria?: string;
  subcategoria?: string;
  tipo?: string;
  descripcion_venta?: string;
  imagen_url?: string;
  campaign_id?: number | null;
  is_active?: boolean;
  imageFile?: File | null;
};

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateProductParams) => {
      let finalImageUrl = params.imagen_url || 'https://placehold.co/400';

      if (params.imageFile) {
        // Compress Image
        const options = {
          maxSizeMB: 0.07, // 70KB
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          fileType: 'image/webp'
        };

        let compressedFile;
        try {
           compressedFile = await imageCompression(params.imageFile, options);
        } catch (error) {
           console.error("Compression ended with error:", error);
           compressedFile = params.imageFile; // Fallback to original if compression fails
        }

        const fileExt = 'webp'; // Force webp extension
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `products/${fileName}`; 

        const { error: uploadError } = await supabase.storage
          .from('imagenes-productos')
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('imagenes-productos')
          .getPublicUrl(filePath);
        
        finalImageUrl = publicUrl;
      }

      const { data, error } = await supabase
        .from('productos')
        .insert({
            nombre: params.nombre,
            precio: params.precio,
            empaque: params.empaque,
            descripcion: params.descripcion || params.nombre, 
            catalogo: params.catalogo || 'General',
            categoria: params.categoria || 'Panadería',
            subcategoria: params.subcategoria || 'Pan Dulce',
            tipo: params.tipo || 'Panadería mexicana',
            descripcion_venta: params.descripcion_venta || params.descripcion || params.nombre,
            imagen_url: finalImageUrl,
            campaign_id: params.campaign_id,
            is_active: params.is_active ?? true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate both products list and stock list (since useStock fetches products)
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
}
