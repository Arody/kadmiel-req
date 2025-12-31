
import { useOrders } from '../../hooks/useOrders';
import { useUserRole } from '../../hooks/useUserRole';
import { useSession } from '../../hooks/useSession';
import { Card, CardContent } from '../../components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Plus, Loader2, Calendar, MapPin, Phone, DollarSign, RefreshCw } from 'lucide-react';


import { useState } from 'react';
import { Input } from '../../components/ui/input';
import { Search } from 'lucide-react';

import { useRecalculateTotals } from '../../hooks/useRecalculateTotals';

export function OrderList() {
  const { data: orders, isLoading: loadingOrders, error, refetch, isRefetching } = useOrders();
  useRecalculateTotals(orders); // Auto-recalculate totals on load

  const { data: role, isLoading: loadingRole } = useUserRole();
  const { session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'delivered': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredOrders = orders?.filter(order => {
      const term = searchTerm.toLowerCase();
      return (
          order.customer_name?.toLowerCase().includes(term) || 
          order.total?.toString().includes(term) ||
          order.folio?.toString().toLowerCase().includes(term) ||
          order.id?.toString().includes(term)
      );
  });

  /* DEBUG INFO */
  const debugInfo = {
      roleLoaded: !!role,
      roleName: role?.role,
      session: !!session,
      ordersLength: orders?.length,
      loadingOrders,
      loadingRole,
      error: error?.message
  };

  if (loadingOrders && !orders) { // Only show loader if we have NO data at all
    return (
       <div className="flex flex-col items-center justify-center py-10 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500">Cargando información...</p>
          <pre className="text-xs text-gray-400">{JSON.stringify(debugInfo, null, 2)}</pre>
       </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Órdenes de Compra</h1>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/pos">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden
              </Button>
            </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
            placeholder="Buscar por cliente, monto o #folio..." 
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {!filteredOrders || filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
               {error ? (
                 <span className="text-red-500">Error al cargar órdenes: {error.message}</span>
               ) : (
                 "No se encontraron órdenes."
               )}
            </CardContent>
          </Card>
        ) : (
            filteredOrders.map((order) => (
             <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                         <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-sm font-bold text-gray-500">#{order.folio}</span>
                            <div className="flex gap-2 text-sm">
                                <span className={`px-2 py-1 rounded-full border text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                                    Envío: {order.status === 'pending' ? 'Pendiente' 
                                     : order.status === 'delivered' ? 'Entregado'
                                     : order.status === 'cancelled' ? 'Cancelado' : order.status}
                                </span>
                                <span className={`px-2 py-1 rounded-full border text-xs font-medium capitalize ${
                                    order.payment_status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' 
                                    : order.payment_status === 'abono' ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                }`}>
                                    Pago: {order.payment_status === 'pending' ? 'Pendiente' 
                                     : order.payment_status === 'abono' ? 'Abono' 
                                     : order.payment_status === 'paid' ? 'Pagado' : order.payment_status}
                                </span>
                            </div>
                         </div>
                         <h3 className="font-semibold text-gray-900 text-lg">{order.customer_name}</h3>
                         <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-gray-500">
                            <div className="flex items-center">
                               <Phone className="mr-1.5 h-3.5 w-3.5" />
                               {order.customer_phone || 'Sin télefono'}
                            </div>
                            <div className="flex items-center">
                               <Calendar className="mr-1.5 h-3.5 w-3.5" />
                               {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'Sin fecha'} {order.delivery_time}
                            </div>
                            <div className="flex items-center">
                               <MapPin className="mr-1.5 h-3.5 w-3.5" />
                               {order.delivery_type === 'pickup' ? 'Recoger en Sucursal' : 'A Domicilio'}
                            </div>
                         </div>
                         {order.notes && (
                            <div className="mt-2 text-xs text-gray-500 italic bg-yellow-50 px-2 py-1 rounded inline-block">
                                📝 {order.notes}
                            </div>
                         )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                         <div className="text-lg font-bold text-gray-900 flex items-center">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            {order.total}
                         </div>
                         <Link to={`/orders/${order.id}`}>
                            <Button variant="outline" size="sm">Ver Detalle</Button>
                         </Link>
                      </div>
                   </div>
                </CardContent>
             </Card>
          ))
        )}
      </div>
    </div>
  );
}
