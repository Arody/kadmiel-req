

import { useProfile } from '../../hooks/useProfile';
import { useUserRole } from '../../hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, DollarSign, Store, Activity, AlertTriangle, Calendar, CreditCard, Clock, XCircle } from 'lucide-react';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../components/ui/input';

// Helper for default dates (Same as OrderList)
const getStartOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
};

const getEndOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
};

export function Dashboard() {
    const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: role } = useUserRole();

    const [startDate, setStartDate] = useState(getStartOfMonth());
    const [endDate, setEndDate] = useState(getEndOfMonth());

    const { data: stats, isLoading } = useDashboardStats({ startDate, endDate });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
             <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                      Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'}
             </h1>
                  <p className="text-gray-500 text-sm">Sucursal: <span className="font-semibold text-gray-900">{role?.sucursal}</span></p>
         </div>
              <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex items-center gap-2 bg-white border rounded-md p-1 shadow-sm">
                      <Calendar className="h-4 w-4 text-gray-500 ml-2" />
                      <Input
                          type="date"
                          className="h-8 w-36 border-0 focus-visible:ring-0 p-0 text-sm"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                      />
                      <span className="text-gray-400">-</span>
                      <Input
                          type="date"
                          className="h-8 w-36 border-0 focus-visible:ring-0 p-0 text-sm"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                      />
                  </div>

                  <Button className="w-full sm:w-auto" onClick={() => navigate('/pos')}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden
                  </Button>
         </div>
      </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Sales */}
         <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                  <DollarSign className="h-4 w-4"/> Ventas Totales
               </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-green-600"/> : (
                          <div className="text-2xl font-bold text-green-700">
                              ${stats?.totalSales?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                          </div>
                      )}
                      <p className="text-xs text-green-600 mt-1">Acumulado del periodo</p>
                  </CardContent>
              </Card>

              {/* Collected (Ingreso) */}
              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                  <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" /> Ingresos Reales
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-blue-600" /> : (
                          <div className="text-2xl font-bold text-blue-700">
                              ${stats?.totalCollected?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                          </div>
                      )}
                      <p className="text-xs text-blue-600 mt-1">Cobrado efectivamente</p>
                  </CardContent>
              </Card>

              {/* Pending (Pendiente) */}
              <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
                  <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Por Cobrar
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-orange-600" /> : (
                          <div className="text-2xl font-bold text-orange-700">
                              ${stats?.totalPending?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                          </div>
                      )}
                      <p className="text-xs text-orange-600 mt-1">Saldo pendiente</p>
                  </CardContent>
              </Card>

              {/* Cancelled */}
              <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200">
                  <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <XCircle className="h-4 w-4" /> Cancelados
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : (
                          <div className="text-2xl font-bold text-gray-700">
                              ${stats?.totalCancelled?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                    </div>
                )}
                      <p className="text-xs text-gray-500 mt-1">Monto en órdenes canceladas</p>
            </CardContent>
         </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Quick Actions */}
              <Card className="md:col-span-3 lg:col-span-1">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Activity className="h-4 w-4"/> Acciones Rápidas
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
               <Link to="/pos" className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50 transition-colors group">
                  <span className="font-medium text-gray-700 group-hover:text-primary">Crear Orden</span>
                  <Plus className="h-3 w-3 text-gray-400 group-hover:text-primary"/>
               </Link>
               <Link to="/orders" className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50 transition-colors group">
                  <span className="font-medium text-gray-700 group-hover:text-primary">Ver Historial</span>
                  <Activity className="h-3 w-3 text-gray-400 group-hover:text-primary"/>
               </Link>
               <Link to="/stock" className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50 transition-colors group">
                  <span className="font-medium text-gray-700 group-hover:text-primary">Inventario</span>
                  <Store className="h-3 w-3 text-gray-400 group-hover:text-primary"/>
               </Link>
            </CardContent>
         </Card>
      </div>

      {/* Inventory Overview */}
      <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2 pt-4">
          <Store className="h-5 w-5 text-gray-400"/> Resumen de Inventario
      </h2>

      <Card>
          <CardContent className="p-0">
             {isLoading ? (
                 <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400"/></div>
             ) : !stats?.stockOverview || stats.stockOverview.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">No hay información de inventario disponible.</div>
             ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">Producto</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Stock Inicial</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Vendido</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Restante</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.stockOverview.map((item: any, idx: number) => (
                                <tr key={idx} className="group hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900"><span>{item.productName}</span></div>
                                        <div className="text-xs text-gray-400"><span>{item.unit}</span></div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500">
                                        {item.initialStock}
                                    </td>
                                    <td className="px-4 py-3 text-right text-amber-600 font-medium">
                                        <span>-{item.sold}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                            item.remaining <= 0 ? 'bg-red-100 text-red-700' :
                                            item.remaining < 5 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-50 text-blue-700'
                                        }`}>
                                            <span>{item.remaining}</span>
                                            {item.remaining <= 0 && <AlertTriangle className="ml-1 h-3 w-3"/>}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
          </CardContent>
      </Card>
    </div>
  );
}

