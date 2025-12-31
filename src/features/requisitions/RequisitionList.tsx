
import { useRequisitions } from '../../hooks/useRequisitions';
import { Card, CardContent } from '../../components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Plus, Loader2, Calendar, MapPin } from 'lucide-react';

// Simple Badge if not exists, but I'll assume I'll create it or use inline styles for now to save a step, 
// OR create it in the same batch. I'll use inline tailwind for speed unless I batch create Badge.tsx.
// I'll create Badge.tsx in this batch.

export function RequisitionList() {
  const { data: requisitions, isLoading } = useRequisitions();

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'delivered': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Requisiciones</h1>
        <Link to="/pos">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : requisitions?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
              No se encontraron requisiciones.
            </CardContent>
          </Card>
        ) : (
          requisitions?.map((req) => (
             <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                         <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-sm font-bold text-gray-500">#{req.id /* Folio might be better */}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(req.status)} capitalize`}>
                              {req.status}
                            </span>
                         </div>
                         <h3 className="font-semibold text-gray-900">{req.solicitante}</h3>
                         <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                            <div className="flex items-center">
                               <MapPin className="mr-1.5 h-3.5 w-3.5" />
                               {req.sucursal}
                            </div>
                            <div className="flex items-center">
                               <Calendar className="mr-1.5 h-3.5 w-3.5" />
                               {new Date(req.created_at).toLocaleDateString()}
                            </div>
                         </div>
                      </div>
                      <div>
                         <Link to={`/requisitions/${req.id}`}>
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
