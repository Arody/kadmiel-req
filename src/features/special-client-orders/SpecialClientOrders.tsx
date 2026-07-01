import { useState } from 'react';
import { Building2, CalendarClock, Loader2, RefreshCw, User } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  markSpecialClientOrderSeen,
  useNewSpecialClientOrderIds,
  useProfileNameMap,
  useSpecialClientOrderLogDiffs,
  useSpecialClientOrders,
  useSpecialClientOrderChangeMarkers,
  type SpecialClientHeaderDiff,
  type SpecialClientOrder,
  type SpecialClientOrderStatus,
  type SpecialClientProductDiff,
} from '../../hooks/useSpecialClientOrders';

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sin fecha';

  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getClientName(order: SpecialClientOrder) {
  return order.clients?.name || `Cliente #${order.client_id}`;
}

function getActorLabel(actor: string | null | undefined, profileNameMap: Record<string, string>) {
  if (!actor) return 'Cliente';
  return profileNameMap[actor] || (actor.includes('@') ? actor : 'Cliente');
}

function formatPlainValue(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  return String(value);
}

function formatHeaderValue(diff: SpecialClientHeaderDiff, value?: string | number | boolean | null) {
  if (diff.field === 'needed_at' && value) return formatDateTime(String(value));
  return formatPlainValue(value);
}

function getProductDiffLabel(change: SpecialClientProductDiff['change']) {
  switch (change) {
    case 'added': return 'Agregado';
    case 'removed': return 'Quitado';
    case 'quantity': return 'Cantidad cambio';
    case 'notes': return 'Nota cambio';
    default: return 'Cambio';
  }
}

function getProductDiffClass(change: SpecialClientProductDiff['change']) {
  switch (change) {
    case 'added': return 'bg-green-50 text-green-900 ring-2 ring-inset ring-green-200';
    case 'removed': return 'bg-red-50 text-red-900 ring-2 ring-inset ring-red-200';
    default: return 'bg-amber-50 text-amber-900 ring-2 ring-inset ring-amber-200';
  }
}

function getProductQuantityText(diff: SpecialClientProductDiff) {
  if (diff.change === 'added') return formatPlainValue(diff.afterQuantity);
  if (diff.change === 'removed') return formatPlainValue(diff.beforeQuantity);
  if (String(diff.beforeQuantity ?? '') === String(diff.afterQuantity ?? '')) return formatPlainValue(diff.afterQuantity);
  return `${formatPlainValue(diff.beforeQuantity)} -> ${formatPlainValue(diff.afterQuantity)}`;
}

function getProductNotesText(diff: SpecialClientProductDiff) {
  if (diff.change === 'added') return formatPlainValue(diff.afterNotes);
  if (diff.change === 'removed') return formatPlainValue(diff.beforeNotes);
  if (String(diff.beforeNotes ?? '') === String(diff.afterNotes ?? '')) return formatPlainValue(diff.afterNotes);
  return `${formatPlainValue(diff.beforeNotes)} -> ${formatPlainValue(diff.afterNotes)}`;
}

function getItemDiffKeys(item: NonNullable<SpecialClientOrder['client_requisition_items']>[number]) {
  const name = item.productos?.nombre?.trim().toLowerCase();
  return [String(item.product_id), ...(name ? [name] : [])];
}

export function SpecialClientOrders() {
  const [status, setStatus] = useState<SpecialClientOrderStatus>('all');
  const { data: orders = [], isLoading, isRefetching, refetch, error } = useSpecialClientOrders(status);
  const newOrderIds = useNewSpecialClientOrderIds();
  const changeMarkers = useSpecialClientOrderChangeMarkers();
  const orderIds = orders.map((order) => order.id);
  const { data: logDiffs = {} } = useSpecialClientOrderLogDiffs(orderIds);
  const actorIds = [...new Set(orders.flatMap((order) => {
    const marker = changeMarkers[String(order.id)];
    const logDiff = logDiffs[String(order.id)];
    return [
      logDiff?.actor || '',
      marker?.actor || '',
      order.last_actor || '',
      order.requested_by_email || '',
    ];
  }).filter(Boolean))];
  const { data: profileNameMap = {} } = useProfileNameMap(actorIds);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pedidos clientes especiales</h1>
          <p className="text-sm text-gray-500">Pedidos enviados por clientes como Holiday Inn y cuentas asignadas.</p>
        </div>

        <div className="flex gap-2">
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as SpecialClientOrderStatus)}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
          </select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-600">
            No se pudieron cargar los pedidos de clientes especiales.
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No hay pedidos de clientes especiales con este filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const items = order.client_requisition_items || [];
            const orderId = String(order.id);
            const marker = changeMarkers[orderId];
            const logDiff = logDiffs[orderId];
            const productDiffs = logDiff?.productDiffs || [];
            const headerDiffs = logDiff?.headerDiffs || [];
            const productDiffByKey = new Map(productDiffs.flatMap((diff) => [[diff.key, diff], [diff.name.trim().toLowerCase(), diff]]));
            const isNew = newOrderIds.includes(orderId);
            const hasProductChanges = productDiffs.length > 0;
            const hasHeaderChanges = headerDiffs.length > 0;
            const hasRealChanges = hasProductChanges || hasHeaderChanges;
            const actor = logDiff?.actor || marker?.actor || order.last_actor || order.requested_by_email || null;
            const changedAt = logDiff?.changedAt || marker?.changedAt || order.updated_at || order.reviewed_at || order.created_at;

            return (
              <Card
                key={order.id}
                className={`bg-white transition ${isNew ? 'cursor-pointer border-red-500 shadow-lg ring-4 ring-red-100' : hasRealChanges ? 'border-orange-200 shadow-sm' : ''}`}
                onClick={() => markSpecialClientOrderSeen(order.id)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {isNew ? (
                          <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase text-white shadow-sm animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-white" />
                            Sin revisar
                          </span>
                        ) : null}
                        {hasRealChanges ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">
                            Cambios detectados
                          </span>
                        ) : null}
                        {hasProductChanges ? (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                            Productos modificados
                          </span>
                        ) : null}
                        <span className="font-mono text-sm font-bold text-gray-500">#{order.id}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                        {order.familia_farrera ? (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            Familia Farrera
                          </span>
                        ) : null}
                      </div>

                      <h2 className="truncate text-lg font-semibold text-gray-900">{getClientName(order)}</h2>

                      {hasRealChanges ? (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                          Modificado por {getActorLabel(actor, profileNameMap)} · {formatDateTime(changedAt)}
                        </div>
                      ) : null}

                      <div className={`mt-3 flex flex-wrap gap-4 rounded-lg p-3 text-sm ${hasHeaderChanges ? 'bg-red-50 text-red-900 ring-2 ring-red-200' : 'text-gray-500'}`}>
                        <span className="flex items-center">
                          <CalendarClock className="mr-1.5 h-4 w-4" />
                          Entrega: {formatDateTime(order.needed_at)}
                        </span>
                        <span className="flex items-center">
                          <Building2 className="mr-1.5 h-4 w-4" />
                          Cargo a: {order.cargo || 'Sin cargo'}
                        </span>
                        <span className="flex items-center">
                          <User className="mr-1.5 h-4 w-4" />
                          {order.requested_by_email || 'Sin correo'}
                        </span>
                      </div>

                      {hasHeaderChanges ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <p className="mb-2 font-bold">Datos modificados</p>
                          <div className="space-y-1">
                            {headerDiffs.map((diff) => (
                              <div key={diff.field}>
                                <span className="font-semibold">{diff.label}:</span>{' '}
                                {formatHeaderValue(diff, diff.before)} {'->'} {formatHeaderValue(diff, diff.after)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {order.notes ? (
                        <p className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-600">{order.notes}</p>
                      ) : null}
                    </div>

                    <div className="text-sm text-gray-500">
                      {hasProductChanges
                        ? `${productDiffs.length} cambio${productDiffs.length === 1 ? '' : 's'} de producto`
                        : `${items.length} producto${items.length === 1 ? '' : 's'}`}
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Producto</th>
                          {hasProductChanges ? <th className="w-40 px-4 py-3">Cambio</th> : null}
                          <th className="w-24 px-4 py-3 text-right">Cantidad</th>
                          <th className="px-4 py-3">Nota</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {items.map((item) => {
                          const diff = getItemDiffKeys(item).map((key) => productDiffByKey.get(key)).find(Boolean);

                          return (
                            <tr key={item.id} className={diff ? getProductDiffClass(diff.change) : undefined}>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {diff ? (
                                  <span className="mr-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase shadow-sm">
                                    {diff.change === 'added' ? '+' : '~'}
                                  </span>
                                ) : null}
                                {item.productos?.nombre || `Producto #${item.product_id}`}
                                {item.productos?.empaque ? (
                                  <span className="ml-2 text-xs font-normal text-gray-500">({item.productos.empaque})</span>
                                ) : null}
                              </td>
                              {hasProductChanges ? (
                                <td className="px-4 py-3 font-bold">{diff ? getProductDiffLabel(diff.change) : '-'}</td>
                              ) : null}
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {diff ? getProductQuantityText(diff) : item.quantity}
                              </td>
                              <td className="px-4 py-3 text-gray-500">{diff ? getProductNotesText(diff) : item.notes || item.note || '-'}</td>
                            </tr>
                          );
                        })}
                        {productDiffs.filter((diff) => diff.change === 'removed').map((diff) => (
                          <tr key={`removed-${diff.key}`} className={getProductDiffClass(diff.change)}>
                            <td className="px-4 py-3 font-semibold">
                              <span className="mr-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase shadow-sm">-</span>
                              {diff.name}
                            </td>
                            <td className="px-4 py-3 font-bold">{getProductDiffLabel(diff.change)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{getProductQuantityText(diff)}</td>
                            <td className="px-4 py-3">{getProductNotesText(diff)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
