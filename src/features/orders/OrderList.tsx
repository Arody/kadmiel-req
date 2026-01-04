
import { useOrders } from '../../hooks/useOrders';

import { Card, CardContent } from '../../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { generateProductionPdf, generateBatchProductionPdf } from '../../utils/pdfGenerator';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Loader2, Calendar, MapPin, Phone, DollarSign, RefreshCw, ChevronLeft, ChevronRight, Printer, FileDown } from 'lucide-react';
// ...


import { useState, type ChangeEvent } from 'react';
import { Input } from '../../components/ui/input';
import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

import { useRecalculateTotals } from '../../hooks/useRecalculateTotals';

export function OrderList() {
   const navigate = useNavigate();
   const [page, setPage] = useState(1);
   const [statusFilter, setStatusFilter] = useState('all');
   const [paymentFilter, setPaymentFilter] = useState('all');
   const [searchTerm, setSearchTerm] = useState('');

   // Initialize dates to current month (Local Time)
   const now = new Date();
   const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
   };

   const firstDay = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
   const lastDay = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

   const [startDate, setStartDate] = useState(firstDay);
   const [endDate, setEndDate] = useState(lastDay);
   const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
   const [isBatchGenerating, setIsBatchGenerating] = useState(false);

   // Debounce search could be added here, but for now we pass directly. 
   // Ideally useDebounce for search term to avoid query spam.

   const { data: queryData, isLoading: loadingOrders, error, refetch, isRefetching } = useOrders({
      page,
      pageSize: 10,
      search: searchTerm,
      status: statusFilter,
      paymentStatus: paymentFilter,
      fromDate: startDate,
      toDate: endDate
   });

   const orders = queryData?.data;
   const totalCount = queryData?.count || 0;
   const totalPages = Math.ceil(totalCount / 10);

   useRecalculateTotals(orders); // Auto-recalculate totals on load

   useRecalculateTotals(orders); // Auto-recalculate totals on load


  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'delivered': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

   /* Removed client-side filtering */



  if (loadingOrders && !orders) { // Only show loader if we have NO data at all
    return (
       <div className="flex flex-col items-center justify-center py-10 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500">Cargando información...</p>
       </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Órdenes de Compra</h1>
        <div className="flex gap-2">
              <Button
                 variant="outline"
                 onClick={async () => {
                    setIsBatchGenerating(true);
                    try {
                       // Replicate filters for fetch
                       let query = supabase.from('ordenes_compra').select('*');

                       if (searchTerm) {
                          const isNumeric = !isNaN(Number(searchTerm));
                          if (isNumeric) {
                             query = query.or(`folio.eq.${searchTerm},customer_phone.ilike.%${searchTerm}%,total.eq.${searchTerm}`);
                          } else {
                             query = query.ilike('customer_name', `%${searchTerm}%`);
                          }
                       }
                       if (statusFilter !== 'all') query = query.eq('status', statusFilter);
                       if (paymentFilter !== 'all') query = query.eq('payment_status', paymentFilter);
                       if (startDate) query = query.gte('delivery_date', startDate);
                       if (endDate) query = query.lte('delivery_date', endDate);

                       const { data, error } = await query.order('created_at', { ascending: false });

                       if (error) throw error;
                       if (error) throw error;
                       if (data) await generateBatchProductionPdf(data as any, { start: startDate, end: endDate });

                    } catch (e) {
                       console.error(e);
                       alert("Error al generar reporte");
                    } finally {
                       setIsBatchGenerating(false);
                    }
                 }}
                 disabled={isBatchGenerating}
              >
                 {isBatchGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                 Imprimir Filtrados
              </Button>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
              <Button onClick={() => navigate('/pos')}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden
              </Button>
        </div>
      </div>

        <div className="flex flex-col md:flex-row gap-4">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                 placeholder="Buscar por cliente, monto o #folio..."
                 className="pl-9 bg-white"
                 value={searchTerm}
                 onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1); // Reset to page 1 on search
                 }}
              />
           </div>

           <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-2 bg-white rounded-md border px-2 py-1">
                 <span className="text-xs text-gray-500">Desde:</span>
                 <Input
                    type="date"
                    value={startDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setStartDate(e.target.value); setPage(1); }}
                    className="w-[130px] border-none h-8 p-0 focus-visible:ring-0"
                 />
                 <span className="text-gray-300">|</span>
                 <span className="text-xs text-gray-500">Hasta:</span>
                 <Input
                    type="date"
                    value={endDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setEndDate(e.target.value); setPage(1); }}
                    className="w-[130px] border-none h-8 p-0 focus-visible:ring-0"
                 />
              </div>
              <div className="w-[180px]">
                 <Select value={statusFilter} onValueChange={(val: string) => { setStatusFilter(val); setPage(1); }}>
                    <SelectTrigger className="bg-white">
                       <SelectValue placeholder="Estado Envío" />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="all">Todos (Envíos)</SelectItem>
                       <SelectItem value="pending">Pendientes</SelectItem>
                       <SelectItem value="delivered">Entregados</SelectItem>
                       <SelectItem value="cancelled">Cancelados</SelectItem>
                    </SelectContent>
                 </Select>
              </div>

              <div className="w-[180px]">
                 <Select value={paymentFilter} onValueChange={(val: string) => { setPaymentFilter(val); setPage(1); }}>
                    <SelectTrigger className="bg-white">
                       <SelectValue placeholder="Estado Pago" />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="all">Todos (Pagos)</SelectItem>
                       <SelectItem value="pending">Pendiente</SelectItem>
                       <SelectItem value="abono">Abono</SelectItem>
                       <SelectItem value="paid">Pagado</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </div>
        </div>

      <div className="grid gap-4">
           {!orders || orders.length === 0 ? (
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
                 orders.map((order) => (
             <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                         <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-sm font-bold text-gray-500">#{order.folio}</span>
                            <div className="flex gap-2 text-sm">
                                <span className={`px-2 py-1 rounded-full border text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                                         <span>Envío: </span><span>{order.status === 'pending' ? 'Pendiente' 
                                     : order.status === 'delivered' ? 'Entregado'
                                               : order.status === 'cancelled' ? 'Cancelado' : order.status}</span>
                                </span>
                                <span className={`px-2 py-1 rounded-full border text-xs font-medium capitalize ${
                                    order.payment_status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' 
                                    : order.payment_status === 'abono' ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                }`}>
                                         <span>Pago: </span><span>{order.payment_status === 'pending' ? 'Pendiente' 
                                     : order.payment_status === 'abono' ? 'Abono' 
                                               : order.payment_status === 'paid' ? 'Pagado' : order.payment_status}</span>
                                </span>
                            </div>
                         </div>
                         <h3 className="font-semibold text-gray-900 text-lg">{order.customer_name}</h3>
                         <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-gray-500">
                            <div className="flex items-center">
                               <Phone className="mr-1.5 h-3.5 w-3.5" />
                                      <span>{order.customer_phone || 'Sin télefono'}</span>
                            </div>
                            <div className="flex items-center">
                               <Calendar className="mr-1.5 h-3.5 w-3.5" />
                                      <span>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'Sin fecha'} {order.delivery_time}</span>
                            </div>
                            <div className="flex items-center">
                               <MapPin className="mr-1.5 h-3.5 w-3.5" />
                                      <span>{order.delivery_type === 'pickup' ? 'Recoger en Sucursal' : 'A Domicilio'}</span>
                            </div>
                         </div>
                         {order.notes && (
                            <div className="mt-2 text-xs text-gray-500 italic bg-yellow-50 px-2 py-1 rounded inline-block">
                                📝 {order.notes}
                            </div>
                         )}
                      </div>
                             <div className="text-right flex flex-col items-end gap-2 sm:w-auto w-full">
                         <div className="text-lg font-bold text-gray-900 flex items-center">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                                   <span>{order.total?.toFixed(2)}</span>
                         </div>
                                <div className="flex flex-col gap-2 w-full sm:w-32">
                                   <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                      onClick={() => navigate(`/orders/${order.id}`)}
                                   >
                                      Ver Detalle
                                   </Button>
                                   <Button
                                      variant="secondary"
                                      size="sm"
                                      className="w-full"
                                      onClick={async () => {
                                         setIsGeneratingPdf(order.id);
                                         try {
                                            await generateProductionPdf(order);
                                         } finally {
                                            setIsGeneratingPdf(null);
                                         }
                                      }}
                                      disabled={isGeneratingPdf === order.id}
                                   >
                                      {isGeneratingPdf === order.id ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Printer className="h-3 w-3 mr-2" />}
                                      PDF Prod.
                                   </Button>
                                </div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          ))
        )}
      </div>

        {/* Pagination Controls */}
        {totalCount > 0 && (
           <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-500">
                 Mostrando {(page - 1) * 10 + 1} a {Math.min(page * 10, totalCount)} de {totalCount} órdenes
              </div>
              <div className="flex items-center gap-2">
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loadingOrders}
                 >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                 </Button>
                 <span className="text-sm font-medium px-2">
                    Página {page} de {totalPages || 1}
                 </span>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loadingOrders}
                 >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                 </Button>
              </div>
           </div>
        )
        }
    </div>
  );
}
