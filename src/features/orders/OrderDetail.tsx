
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Calendar, Loader2, MapPin, User, Trash2, Plus, Minus, Search, X } from 'lucide-react';
import { type Order } from '../../hooks/useOrders';
import { useUpdateOrder } from '../../hooks/useUpdateOrder';
import { useState } from 'react';
import { useOrderPayments } from '../../hooks/useOrderPayments';
import { useOrderItems } from '../../hooks/useOrderItems';
import { useProducts } from '../../hooks/useProducts';
import { Input } from '../../components/ui/input';

function useOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data: order, error: orderError } = await supabase
        .from('ordenes_compra')
        .select('*')
        .eq('id', id)
        .single();
      
      if (orderError) throw orderError;
        if (!order) throw new Error('Orden no encontrada');

      let creatorName = 'Desconocido';
      if (order.created_by) {
          const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', order.created_by)
              .maybeSingle();
          if (profile) creatorName = profile.full_name;
      }

      const { data: items, error: itemsError } = await supabase
        .from('orden_compra_detalles')
        .select(`
           *,
           productos (
             nombre,
             empaque
           )
        `)
        .eq('order_id', id)
        .order('id', { ascending: true }); // Keep consistent order

      if (itemsError) throw itemsError;

      return { ...order, items, creator_name: creatorName } as Order & { items: any[] };
    },
    enabled: !!id
  });
}

function PaymentSection({ orderId, total, paidAmount }: { orderId: string, total: number, paidAmount: number }) {
  const { payments, isLoading, addPayment } = useOrderPayments(orderId);
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
      const val = parseFloat(amount);
      if (!isNaN(val) && val > 0) {
          addPayment.mutate({ orderId, amount: val });
          setAmount('');
      }
  };

  return (
    <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
        <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue-800 font-medium">Historial de Abonos</span>
        </div>
        
        <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
            {isLoading ? (
                <div className="text-xs text-center text-blue-400">Cargando abonos...</div>
            ) : !payments || payments.length === 0 ? (
                <div className="text-xs text-center text-blue-400">Sin abonos registrados</div>
            ) : (
                payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs bg-white p-2 rounded border border-blue-100">
                        <div>
                            <span className="font-semibold block">${p.amount}</span>
                            <span className="text-gray-400">{new Date(p.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-gray-500">{p.creator_name}</span>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="flex gap-2">
        <input 
            type="number" 
            placeholder="Monto" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1.5"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={addPayment.isPending}>
            {addPayment.isPending ? '...' : 'Abonar'}
        </Button>
        </div>
        <div className="mt-2 text-xs text-blue-600 flex justify-between font-medium">
            <span>Total Abonado: ${paidAmount}</span>
            <span>Restante: ${(total - (paidAmount || 0)).toFixed(2)}</span>
        </div>
    </div>
  );
}

// Subcomponent for Adding Items
function AddItemSection({ orderId, onCancel }: { orderId: string, onCancel: () => void }) {
    const [search, setSearch] = useState('');
    const { data: products, isLoading } = useProducts(search);
    const { addItem } = useOrderItems();

    const handleSelect = async (product: any) => {
        await addItem.mutateAsync({
            orderId,
            productId: product.id,
            quantity: 1,
            price: product.precio
        });
        // Keep window open to add more? Or close? Let's keep open for rapid entry but maybe clear search
        // onCancel(); 
    };

    return (
        <div className="bg-gray-50 p-4 rounded-md border mb-4">
             <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-semibold text-gray-700">Agregar Producto</h4>
                 <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancel}>
                     <X className="h-4 w-4" />
                 </Button>
             </div>
             <div className="relative mb-3">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                 <Input 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    placeholder="Buscar producto..." 
                    className="pl-9 bg-white"
                    autoFocus
                 />
             </div>
             <div className="max-h-48 overflow-y-auto space-y-2">
                 {isLoading ? (
                     <div className="p-2 text-center text-xs text-gray-500">Buscando...</div>
                 ) : !products ? (
                     <div className="p-2 text-center text-xs text-gray-500">Empieza a escribir...</div>
                 ) : products.length === 0 ? (
                     <div className="p-2 text-center text-xs text-gray-500">No se encontraron productos</div>
                 ) : (
                     products.map(p => (
                         <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded border hover:bg-blue-50 cursor-pointer" onClick={() => handleSelect(p)}>
                             <div className="flex items-center gap-2">
                                <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                                    {p.imagen_url ? <img src={p.imagen_url} className="w-full h-full object-cover"/> : '🥐'}
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{p.nombre}</p>
                                    <p className="text-xs text-gray-500">${p.precio} - {p.empaque}</p>
                                </div>
                             </div>
                             <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600">
                                 <Plus className="h-4 w-4" />
                             </Button>
                         </div>
                     ))
                 )}
             </div>
        </div>
    )
}

export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
    const { data: order, isLoading, error } = useOrderDetail(id);
  const { mutate: updateOrder, isPending: isUpdating } = useUpdateOrder();
  const { updateItem, deleteItem } = useOrderItems();
  const [isAddingItem, setIsAddingItem] = useState(false);

  if (isLoading) {
     return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-2">Error al cargar la orden.</p>
                <p className="text-gray-500 text-sm">{(error as Error).message}</p>
                <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Regresar</Button>
            </div>
        );
    }

  if (!order || !id) {
     return <div className="p-8 text-center text-red-500">Orden no encontrada.</div>;
  }

  const handleUpdateQty = (itemId: string, newQty: number) => {
      if (newQty < 1) return;
      updateItem.mutate({ itemId, quantity: newQty, orderId: id });
  };

    // Calculate total dynamically from items to ensure real-time accuracy
    const calculatedTotal = order.items?.reduce((sum: number, item: any) => sum + (item.cantidad * item.precio_unitario), 0) || 0;

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
             <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de Orden</h1>
       </div>

       <div className="grid gap-6 md:grid-cols-3">
          {/* Header Info */}
          <Card className="md:col-span-2">
             <CardHeader>
                <CardTitle className="flex justify-between items-center">
                   <span>Orden #{order.folio}</span>
                   <span className={`text-sm font-normal px-3 py-1 rounded-full border capitalize ${
                       order.status === 'delivered' ? 'bg-green-100 text-green-800 border-green-200' 
                       : order.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200'
                       : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                   }`}>
                      {order.status === 'pending' ? 'Pendiente' 
                       : order.status === 'delivered' ? 'Entregado'
                       : order.status === 'cancelled' ? 'Cancelado' : order.status}
                   </span>
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><User className="h-4 w-4"/> Cliente</h4>
                      <div className="pl-6 space-y-1">
                          <span className="block font-medium">{order.customer_name}</span>
                          <span className="block text-gray-500">{order.customer_phone}</span>
                      </div>
                   </div>
                   
                   <div>
                       <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><MapPin className="h-4 w-4"/> Entrega</h4>
                       <div className="pl-6 space-y-1">
                          <span className="block capitalize">{order.delivery_type === 'pickup' ? 'Recoger en Sucursal' : 'Domicilio'}</span>
                          {order.delivery_type === 'delivery' && (
                              <span className="block text-gray-500">{order.delivery_address}</span>
                          )}
                          <span className="block flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {order.delivery_date} {order.delivery_time}
                          </span>
                       </div>
                   </div>
                </div>

                {order.notes && (
                    <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100 mt-4">
                        <h4 className="font-semibold text-gray-900 text-xs mb-1">Notas</h4>
                        <p className="text-gray-700 text-sm">{order.notes}</p>
                    </div>
                )}

                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 block">Sucursal</span>
                        <span className="font-medium">{order.sucursal}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block">Creado Por</span>
                        <span className="font-medium text-sm">{order.creator_name || 'Desconocido'}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                </div>
             </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
              <CardHeader><CardTitle>Pago y Estado</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                  {/* Payment Status Control */}
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estatus de Pago</label>
                      <div className="flex flex-wrap gap-2">
                          {['pending', 'abono', 'paid'].map((status) => (
                              <button
                                key={status}
                                onClick={() => updateOrder({ id: order.id, payment_status: status })}
                                disabled={isUpdating}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border border-transparent transition-colors capitalize ${
                                    order.payment_status === status
                                    ? status === 'paid' ? 'bg-green-100 text-green-800 border-green-200 ring-2 ring-green-500 ring-offset-1'
                                    : status === 'abono' ? 'bg-blue-100 text-blue-800 border-blue-200 ring-2 ring-blue-500 ring-offset-1'
                                    : 'bg-yellow-100 text-yellow-800 border-yellow-200 ring-2 ring-yellow-500 ring-offset-1'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                  {status === 'pending' ? 'Pendiente' 
                                   : status === 'abono' ? 'Abono' 
                                   : status === 'paid' ? 'Pagado' : status}
                              </button>
                          ))}
                      </div>

                      {/* Abono List & Input */}
                      {order.payment_status === 'abono' && (
                              <PaymentSection orderId={order.id} total={calculatedTotal} paidAmount={order.paid_amount || 0} />
                      )}
                  </div>

                  {/* Delivery Status Control */}
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estatus de Entrega</label>
                      <div className="flex flex-wrap gap-2">
                          {['pending', 'delivered', 'cancelled'].map((status) => (
                              <button
                                key={status}
                                onClick={() => updateOrder({ id: order.id, status: status })}
                                disabled={isUpdating}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border border-transparent transition-colors capitalize ${
                                    order.status === status
                                    ? status === 'delivered' ? 'bg-green-100 text-green-800 border-green-200 ring-2 ring-green-500 ring-offset-1'
                                    : status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200 ring-2 ring-red-500 ring-offset-1'
                                    : 'bg-yellow-100 text-yellow-800 border-yellow-200 ring-2 ring-yellow-500 ring-offset-1'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                  {status === 'pending' ? 'Pendiente' 
                                   : status === 'delivered' ? 'Entregado'
                                   : status === 'cancelled' ? 'Cancelado' : status}
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-500">Método</span>
                        <span className="capitalize font-medium">{order.payment_method || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total</span>
                              <span>${calculatedTotal.toFixed(2)}</span>
                      </div>
                      {order.payment_status === 'abono' && (
                          <div className="flex justify-between items-center text-sm mt-1 text-red-600 font-medium">
                              <span>Restante</span>
                                  <span>${(calculatedTotal - (order.paid_amount || 0)).toFixed(2)}</span>
                          </div>
                      )}
                  </div>
              </CardContent>
          </Card>

          {/* Items List */}
          <Card className="md:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle>Productos ({order.items?.length || 0})</CardTitle>
                 <Button size="sm" variant="outline" onClick={() => setIsAddingItem(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Producto
                 </Button>
              </CardHeader>
              <CardContent>
                 {isAddingItem && (
                     <AddItemSection orderId={id} onCancel={() => setIsAddingItem(false)} />
                 )}

                 <div className="rounded-md border overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                       <thead className="bg-gray-50">
                          <tr>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio U.</th>
                             <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                             <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                             <th className="px-6 py-3 w-10"></th>
                          </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-gray-200">
                          {order.items?.map((item: any) => (
                             <tr key={item.id} className="hover:bg-gray-50 group">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                   {item.productos?.nombre || `ID: ${item.producto_id}`}
                                   <span className="block text-xs text-gray-500 font-normal">{item.productos?.empaque}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                   ${item.precio_unitario}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                   <div className="flex items-center justify-center gap-2">
                                       <button 
                                          onClick={() => handleUpdateQty(item.id, item.cantidad - 1)}
                                          className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                       >
                                           <Minus className="h-3 w-3" />
                                       </button>
                                       <span className="w-8 text-center font-medium">{item.cantidad}</span>
                                       <button 
                                          onClick={() => handleUpdateQty(item.id, item.cantidad + 1)}
                                          className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                       >
                                           <Plus className="h-3 w-3" />
                                       </button>
                                   </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                   ${(item.cantidad * item.precio_unitario).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => {
                                            if(confirm('¿Eliminar producto de la orden?')) {
                                                deleteItem.mutate({ itemId: item.id, orderId: id });
                                            }
                                        }}
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
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
