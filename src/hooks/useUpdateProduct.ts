
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import imageCompression from 'browser-image-compression';

export type UpdateProductParams = {
  id: number;
  nombre?: string;
  precio?: number;
  empaque?: string;
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

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateProductParams) => {
      let finalImageUrl = params.imagen_url;

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
           compressedFile = params.imageFile;
        }

        const fileExt = 'webp';
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
      } else {
        // If NO file and NO imagen_url provided, it means we MIGHT keep existing. 
        // But if params.imagen_url IS provided, it updates it.
        // Actually, logic is fine: let finalImageUrl = params.imagen_url;
        // If file, finalImageUrl becomes publicUrl.
        // If no file, finalImageUrl stays params.imagen_url.
        // If params.imagen_url is undefined, it skips update.
        // IMPORTANT: The issue likely is that `setImageFile(null)` in dialog,
        // but are we passing `imagen_url` from current state?
        // Let's debug. 
        // Logic seems OK. Wait, if finalImageUrl is undefined...
        // Ah, if params.imagen_url is UNDEFINED, updates.imagen_url is NOT set.
        // But if params.imageFile is set, finalImageUrl IS set.
        // The issue is if finalImageUrl is NOT undefined, it adds to updates.
      }

      // Build update object dynamically
      const updates: any = {};
      if (params.nombre !== undefined) updates.nombre = params.nombre;
      if (params.precio !== undefined) updates.precio = params.precio;
      if (params.empaque !== undefined) updates.empaque = params.empaque;
      if (params.descripcion !== undefined) updates.descripcion = params.descripcion;
      if (params.catalogo !== undefined) updates.catalogo = params.catalogo;
      if (params.categoria !== undefined) updates.categoria = params.categoria;
      if (params.subcategoria !== undefined) updates.subcategoria = params.subcategoria;
      if (params.tipo !== undefined) updates.tipo = params.tipo;
      if (params.descripcion_venta !== undefined) updates.descripcion_venta = params.descripcion_venta;
      if (finalImageUrl !== undefined) updates.imagen_url = finalImageUrl;
      if (params.campaign_id !== undefined) updates.campaign_id = params.campaign_id;
      if (params.is_active !== undefined) updates.is_active = params.is_active;

      const { data, error } = await supabase
        .from('productos')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
}
