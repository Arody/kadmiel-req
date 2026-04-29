
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import type { ParsedProductRow } from '../utils/fileImportUtils';

export type BulkImportResult = {
  total: number;
  success: number;
  failed: number;
  errors: string[];
};

export type BulkImportProgress = {
  current: number;
  total: number;
  currentProduct: string;
};

export function useBulkImportProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      products,
      onProgress,
    }: {
      products: ParsedProductRow[];
      onProgress?: (progress: BulkImportProgress) => void;
    }): Promise<BulkImportResult> => {
      const result: BulkImportResult = {
        total: products.length,
        success: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        onProgress?.({
          current: i + 1,
          total: products.length,
          currentProduct: product.nombre,
        });

        try {
          let finalImageUrl = 'https://placehold.co/400';

          // Handle image: either from file (embedded in Excel) or from URL
          if (product._imageFile) {
            // Compress and upload embedded image
            const options = {
              maxSizeMB: 0.07,
              maxWidthOrHeight: 1024,
              useWebWorker: true,
              fileType: 'image/webp' as const,
            };

            let compressedFile: File | Blob;
            try {
              compressedFile = await imageCompression(product._imageFile, options);
            } catch {
              compressedFile = product._imageFile;
            }

            const fileName = `${Math.random()}.webp`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('imagenes-productos')
              .upload(filePath, compressedFile);

            if (uploadError) {
              console.error('Upload error:', uploadError);
            } else {
              const {
                data: { publicUrl },
              } = supabase.storage.from('imagenes-productos').getPublicUrl(filePath);
              finalImageUrl = publicUrl;
            }
          } else if (product.imagen_url && product.imagen_url.startsWith('http')) {
            finalImageUrl = product.imagen_url;
          }

          // Insert product into Supabase
          const { error } = await supabase
            .from('productos')
            .insert({
              nombre: product.nombre,
              precio: product.precio,
              empaque: product.empaque || 'Unidad',
              descripcion: product.descripcion || product.nombre,
              catalogo: product.catalogo || 'General',
              categoria: product.categoria || '',
              subcategoria: product.subcategoria || '',
              tipo: product.tipo || '-',
              descripcion_venta: product.descripcion || product.nombre,
              imagen_url: finalImageUrl,
              is_active: true,
            });

          if (error) {
            result.failed++;
            result.errors.push(`Fila ${product._rowIndex}: ${error.message}`);
          } else {
            result.success++;
          }
        } catch (err: any) {
          result.failed++;
          result.errors.push(
            `Fila ${product._rowIndex} (${product.nombre}): ${err.message || 'Error desconocido'}`
          );
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
