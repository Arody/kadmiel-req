
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { type Requisition } from '../../hooks/useRequisitions'; // Type

// We need a hook or just fetch directly here for simplicity
function useRequisitionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['requisition', id],
    queryFn: async () => {
      if (!id) return null;
      // Fetch Header
      const { data: req, error: reqError } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('id', id)
        .single();
      
      if (reqError) throw reqError;

      // Fetch Details (Items)
      const { data: items, error: itemsError } = await supabase
        .from('requisicion_detalles')
        .select(`
           *,
           productos (
             nombre,
             empaque
           )
        `)
        .eq('requisicion_id', id);

      if (itemsError) throw itemsError;

      return { ...req, items } as Requisition & { items: any[] };
    },
    enabled: !!id
  });
}

export function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: requisition, isLoading } = useRequisitionDetail(id);

  if (isLoading) {
     return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!requisition) {
     return <div className="p-8 text-center text-red-500">Requisición no encontrada.</div>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
             <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de Requisición</h1>
       </div>

       <div className="grid gap-6 md:grid-cols-3">
          {/* Header Info */}
          <Card className="md:col-span-2">
             <CardHeader>
                <CardTitle className="flex justify-between items-center">
                   <span>Requisición #{requisition.id}</span>
                   <span className="text-sm font-normal px-3 py-1 bg-gray-100 rounded-full border border-gray-200 capitalize">
                      {requisition.status}
                   </span>
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                      <span className="text-gray-500 block">Sucursal</span>
                      <span className="font-medium">{requisition.sucursal}</span>
                   </div>
                   <div>
                      <span className="text-gray-500 block">Solicitante</span>
                      <span className="font-medium">{requisition.solicitante}</span>
                   </div>
                   <div>
                      <span className="text-gray-500 block">Fecha</span>
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3 w-3" />
                        {new Date(requisition.created_at).toLocaleDateString()}
                      </span>
                   </div>
                   <div>
                      <span className="text-gray-500 block">Puesto</span>
                      <span className="font-medium">{requisition.puesto}</span>
                   </div>
                </div>
             </CardContent>
          </Card>

          {/* Items List */}
          <Card className="md:col-span-3">
              <CardHeader>
                 <CardTitle>Productos Solicitados</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="rounded-md border">
                    <table className="min-w-full divide-y divide-gray-200">
                       <thead className="bg-gray-50">
                          <tr>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                             <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                          </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-gray-200">
                          {requisition.items?.map((item: any) => (
                             <tr key={item.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                   {item.productos?.nombre || `ID: ${item.producto_id}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                   {item.productos?.empaque || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                   {item.cantidad}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </CardContent>
          </Card>
       </div>
    </div>
  );
}
