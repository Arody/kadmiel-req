

import { useProfile } from '../../hooks/useProfile';
import { useUserRole } from '../../hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, DollarSign, Store, Activity, AlertTriangle } from 'lucide-react';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { Loader2 } from 'lucide-react';

export function Dashboard() {
    const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: role } = useUserRole();
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
             <h1 className="text-2xl font-bold tracking-tight text-gray-900">
               Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'}
             </h1>
             <p className="text-gray-500 text-sm">Sucursal: <span className="font-semibold text-gray-900">{role?.sucursal}</span></p>
         </div>
         <div className="flex gap-2">
                  <Button className="w-full sm:w-auto" onClick={() => navigate('/pos')}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden
                  </Button>
         </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
         {/* Sales Card */}
         <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                  <DollarSign className="h-4 w-4"/> Ventas Totales
               </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-green-600"/> : (
                    <div className="text-3xl font-bold text-green-700">
                      ${stats?.totalSales.toFixed(2) || '0.00'}
                    </div>
                )}
                <p className="text-xs text-green-600 mt-1">Acumulado de órdenes activas</p>
            </CardContent>
         </Card>
         
         {/* Quick Actions - Kept but refined */}
         <Card>
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
                                        <div className="font-medium text-gray-900">{item.productName}</div>
                                        <div className="text-xs text-gray-400">{item.unit}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500">
                                        {item.initialStock}
                                    </td>
                                    <td className="px-4 py-3 text-right text-amber-600 font-medium">
                                        -{item.sold}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                            item.remaining <= 0 ? 'bg-red-100 text-red-700' :
                                            item.remaining < 5 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-50 text-blue-700'
                                        }`}>
                                            {item.remaining}
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

