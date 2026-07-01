import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useSession } from './useSession';
import { useUserRole } from './useUserRole';

const NEW_ORDER_IDS_KEY = 'kadmiel.newSpecialClientOrderIds';
const NEW_ORDER_IDS_EVENT = 'kadmiel:new-special-client-order-ids';
const ORDER_CHANGE_MARKERS_KEY = 'kadmiel.specialClientOrderChangeMarkers';
const ORDER_CHANGE_MARKERS_EVENT = 'kadmiel:special-client-order-change-markers';
const SIDEBAR_BADGE_IDS_KEY = 'kadmiel.specialClientOrderBadgeIds';
const SIDEBAR_BADGE_IDS_EVENT = 'kadmiel:special-client-order-badge-ids';
const SIDEBAR_BADGE_MUTED_KEY = 'kadmiel.specialClientOrderBadgeMuted';

export type SpecialClientOrderStatus = 'all' | 'pending' | 'approved' | 'rejected';

export type SpecialClientOrderItem = {
  id: string | number;
  product_id: string | number;
  quantity: number;
  notes?: string | null;
  note?: string | null;
  productos?: {
    nombre?: string | null;
    empaque?: string | null;
  } | null;
};

export type SpecialClientOrder = {
  id: string | number;
  client_id: string | number;
  requested_by_email?: string | null;
  needed_at?: string | null;
  notes?: string | null;
  cargo?: string | null;
  familia_farrera?: boolean | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  reviewed_at?: string | null;
  last_actor?: string | null;
  clients?: {
    name?: string | null;
  } | null;
  client_requisition_items?: SpecialClientOrderItem[];
};

export type SpecialClientOrderChangeMarker = {
  header?: boolean;
  productsChanged?: boolean;
  itemIds?: string[];
  actor?: string | null;
  changedAt?: string;
};

export type SpecialClientOrderChangeMarkers = Record<string, SpecialClientOrderChangeMarker>;

export type SpecialClientProductDiff = {
  key: string;
  name: string;
  change: 'added' | 'removed' | 'quantity' | 'notes' | 'changed';
  beforeQuantity?: number | string | null;
  afterQuantity?: number | string | null;
  beforeNotes?: string | null;
  afterNotes?: string | null;
};

export type SpecialClientHeaderDiff = {
  field: string;
  label: string;
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
};

export type SpecialClientOrderLogDiff = {
  orderId: string;
  actor?: string | null;
  changedAt?: string | null;
  productDiffs: SpecialClientProductDiff[];
  headerDiffs: SpecialClientHeaderDiff[];
};

type ClientRequisitionLog = Record<string, unknown>;
type SnapshotProduct = {
  key: string;
  name: string;
  quantity?: number | string | null;
  notes?: string | null;
};

function readIds(key: string) {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readChangeMarkers() {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORDER_CHANGE_MARKERS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as SpecialClientOrderChangeMarkers
      : {};
  } catch {
    return {};
  }
}

function writeChangeMarkers(markers: SpecialClientOrderChangeMarkers) {
  window.localStorage.setItem(ORDER_CHANGE_MARKERS_KEY, JSON.stringify(markers));
  window.dispatchEvent(new Event(ORDER_CHANGE_MARKERS_EVENT));
}

function writeIds(key: string, eventName: string, ids: string[]) {
  window.localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new Event(eventName));
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

function readPath(record: Record<string, unknown> | null, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((current, part) => (
      current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined
    ), record);

    if (value !== undefined && value !== null) return value;
  }

  return null;
}

function getLogOrderId(log: ClientRequisitionLog) {
  const value = readPath(log, ['requisition_id', 'client_requisition_id', 'order_id']);
  return value == null ? null : String(value);
}

function getLogSnapshot(log: ClientRequisitionLog) {
  const changes = asRecord(log.changes) || asRecord(log.snapshot) || asRecord(log);
  const snapshot = asRecord(readPath(changes, ['after', 'snapshot', 'current', 'data'])) || changes;
  return snapshot;
}

function getLogActor(log: ClientRequisitionLog) {
  const value = readPath(log, ['actor_email', 'user_email', 'email', 'actor', 'user_id', 'last_actor', 'requested_by_email']);
  return typeof value === 'string' ? value : null;
}

function getLogChangedAt(log: ClientRequisitionLog) {
  const value = readPath(log, ['created_at', 'updated_at', 'changed_at']);
  return typeof value === 'string' ? value : null;
}

function getSnapshotProducts(snapshot: Record<string, unknown> | null) {
  const productSource = ['items', 'products', 'productos', 'client_requisition_items'].find((path) => (
    Array.isArray(readPath(snapshot, [path]))
  ));
  const products = productSource ? readPath(snapshot, [productSource]) : null;
  if (!Array.isArray(products)) return [];

  return products.map((product, index): SnapshotProduct | null => {
    const row = asRecord(product);
    if (!row) return null;

    const name = readPath(row, ['product_name', 'nombre', 'name', 'product.nombre', 'product.name', 'productos.nombre']);
    const productId = readPath(row, [
      'product_id',
      'producto_id',
      'product.id',
      'product.product_id',
      'productos.id',
      'productos.product_id',
      ...(productSource === 'productos' ? ['id'] : []),
    ]);
    const quantity = readPath(row, ['quantity', 'cantidad']);
    const notes = readPath(row, ['notes', 'note', 'notas']);
    const key = String(productId || (typeof name === 'string' ? name.trim().toLowerCase() : '') || index);

    return {
      key,
      name: String(name || `Producto #${key}`),
      quantity: quantity as number | string | null,
      notes: notes == null ? null : String(notes),
    };
  }).filter(Boolean) as SnapshotProduct[];
}

function diffProducts(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const beforeProducts = new Map(getSnapshotProducts(before).map((product) => [product.key, product]));
  const afterProducts = new Map(getSnapshotProducts(after).map((product) => [product.key, product]));
  const diffs: SpecialClientProductDiff[] = [];

  afterProducts.forEach((afterProduct, key) => {
    const beforeProduct = beforeProducts.get(key);

    if (!beforeProduct) {
      diffs.push({
        key,
        name: afterProduct.name,
        change: 'added',
        afterQuantity: afterProduct.quantity,
        afterNotes: afterProduct.notes,
      });
      return;
    }

    const quantityChanged = String(beforeProduct.quantity ?? '') !== String(afterProduct.quantity ?? '');
    const notesChanged = String(beforeProduct.notes ?? '') !== String(afterProduct.notes ?? '');

    if (quantityChanged || notesChanged) {
      diffs.push({
        key,
        name: afterProduct.name,
        change: quantityChanged && notesChanged ? 'changed' : quantityChanged ? 'quantity' : 'notes',
        beforeQuantity: beforeProduct.quantity,
        afterQuantity: afterProduct.quantity,
        beforeNotes: beforeProduct.notes,
        afterNotes: afterProduct.notes,
      });
    }
  });

  beforeProducts.forEach((beforeProduct, key) => {
    if (!afterProducts.has(key)) {
      diffs.push({
        key,
        name: beforeProduct.name,
        change: 'removed',
        beforeQuantity: beforeProduct.quantity,
        beforeNotes: beforeProduct.notes,
      });
    }
  });

  return diffs;
}

function diffHeader(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const fields = [
    ['needed_at', 'Entrega'],
    ['cargo', 'Cargo a'],
    ['notes', 'Notas'],
    ['familia_farrera', 'Familia Farrera'],
  ] as const;

  return fields.flatMap(([field, label]) => {
    const beforeValue = readPath(before, [field]);
    const afterValue = readPath(after, [field]);

    return String(beforeValue ?? '') === String(afterValue ?? '')
      ? []
      : [{ field, label, before: beforeValue as string | number | boolean | null, after: afterValue as string | number | boolean | null }];
  });
}

function latestDiffForLogs(orderId: string, logs: ClientRequisitionLog[]): SpecialClientOrderLogDiff | null {
  const orderedLogs = [...logs].sort((a, b) => String(getLogChangedAt(a) || '').localeCompare(String(getLogChangedAt(b) || '')));

  for (let index = orderedLogs.length - 1; index > 0; index--) {
    const currentLog = orderedLogs[index];
    const action = String(readPath(currentLog, ['action']) || '').toLowerCase();
    if (action && action !== 'updated' && action !== 'edit' && action !== 'edited') continue;

    const before = getLogSnapshot(orderedLogs[index - 1]);
    const after = getLogSnapshot(currentLog);
    const productDiffs = diffProducts(before, after);
    const headerDiffs = diffHeader(before, after);

    if (productDiffs.length > 0 || headerDiffs.length > 0) {
      return {
        orderId,
        actor: getLogActor(currentLog),
        changedAt: getLogChangedAt(currentLog),
        productDiffs,
        headerDiffs,
      };
    }
  }

  return null;
}

async function fetchSpecialClientOrderLogRows(orderIds: string[]) {
  const runQuery = async (orderColumn: 'requisition_id' | 'client_requisition_id') => {
    const { data, error } = await supabase
      .from('client_requisitions_logs')
      .select('*')
      .in(orderColumn, orderIds)
      .limit(1000);

    return { data: (data || []) as ClientRequisitionLog[], error };
  };

  const firstResult = await runQuery('requisition_id');
  if (!firstResult.error) return firstResult.data;

  const secondResult = await runQuery('client_requisition_id');
  if (!secondResult.error) return secondResult.data;

  console.error('Error fetching special client order logs:', firstResult.error, secondResult.error);
  return [];
}

function buildSpecialClientOrderLogDiffs(logs: ClientRequisitionLog[]) {
  const groupedLogs = logs.reduce<Record<string, ClientRequisitionLog[]>>((groups, log) => {
    const orderId = getLogOrderId(log);
    if (!orderId) return groups;

    groups[orderId] = [...(groups[orderId] || []), log];
    return groups;
  }, {});

  return Object.fromEntries(
    Object.entries(groupedLogs)
      .map(([orderId, orderLogs]) => [orderId, latestDiffForLogs(orderId, orderLogs)] as const)
      .filter((entry): entry is readonly [string, SpecialClientOrderLogDiff] => entry[1] !== null)
  );
}

function isSidebarBadgeMuted() {
  return typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_BADGE_MUTED_KEY) === '1';
}

function setSidebarBadgeMuted(muted: boolean) {
  window.localStorage.setItem(SIDEBAR_BADGE_MUTED_KEY, muted ? '1' : '0');
  window.dispatchEvent(new Event(SIDEBAR_BADGE_IDS_EVENT));
}

export function addNewSpecialClientOrderId(id?: string | number | null) {
  if (typeof window === 'undefined' || id == null) return;
  const stringId = String(id);
  setSidebarBadgeMuted(false);
  writeIds(NEW_ORDER_IDS_KEY, NEW_ORDER_IDS_EVENT, [stringId, ...readIds(NEW_ORDER_IDS_KEY)]);
  writeIds(SIDEBAR_BADGE_IDS_KEY, SIDEBAR_BADGE_IDS_EVENT, [stringId, ...readIds(SIDEBAR_BADGE_IDS_KEY)]);
}

export function addSpecialClientOrderChange(
  orderId?: string | number | null,
  change: SpecialClientOrderChangeMarker = { header: true }
) {
  if (typeof window === 'undefined' || orderId == null) return;

  const stringId = String(orderId);
  const markers = readChangeMarkers();
  const current = markers[stringId] || {};
  const itemIds = [...new Set([...(current.itemIds || []), ...(change.itemIds || [])])];

  markers[stringId] = {
    header: current.header || change.header,
    productsChanged: current.productsChanged || change.productsChanged,
    itemIds,
    actor: change.actor || current.actor,
    changedAt: change.changedAt || current.changedAt || new Date().toISOString(),
  };

  addNewSpecialClientOrderId(stringId);
  writeChangeMarkers(markers);
}

export function markSpecialClientOrderSeen(id: string | number) {
  if (typeof window === 'undefined') return;
  const stringId = String(id);
  writeIds(NEW_ORDER_IDS_KEY, NEW_ORDER_IDS_EVENT, readIds(NEW_ORDER_IDS_KEY).filter((storedId) => storedId !== stringId));
}

export function clearSpecialClientOrderSidebarBadge() {
  if (typeof window === 'undefined') return;
  setSidebarBadgeMuted(true);
  writeIds(SIDEBAR_BADGE_IDS_KEY, SIDEBAR_BADGE_IDS_EVENT, []);
}

export function syncSpecialClientOrderSidebarBadgeIds(ids: Array<string | number>) {
  if (typeof window === 'undefined' || isSidebarBadgeMuted()) return;
  writeIds(SIDEBAR_BADGE_IDS_KEY, SIDEBAR_BADGE_IDS_EVENT, ids.map(String));
}

export function useNewSpecialClientOrderIds() {
  const [ids, setIds] = useState<string[]>(() => readIds(NEW_ORDER_IDS_KEY));

  useEffect(() => {
    const syncIds = () => setIds(readIds(NEW_ORDER_IDS_KEY));

    window.addEventListener(NEW_ORDER_IDS_EVENT, syncIds);
    window.addEventListener('storage', syncIds);

    return () => {
      window.removeEventListener(NEW_ORDER_IDS_EVENT, syncIds);
      window.removeEventListener('storage', syncIds);
    };
  }, []);

  return ids;
}

export function useSpecialClientOrderChangeMarkers() {
  const [markers, setMarkers] = useState<SpecialClientOrderChangeMarkers>(readChangeMarkers);

  useEffect(() => {
    const syncMarkers = () => setMarkers(readChangeMarkers());

    window.addEventListener(ORDER_CHANGE_MARKERS_EVENT, syncMarkers);
    window.addEventListener('storage', syncMarkers);

    return () => {
      window.removeEventListener(ORDER_CHANGE_MARKERS_EVENT, syncMarkers);
      window.removeEventListener('storage', syncMarkers);
    };
  }, []);

  return markers;
}

export function useSpecialClientOrderSidebarBadgeCount() {
  const [count, setCount] = useState(() => isSidebarBadgeMuted() ? 0 : readIds(SIDEBAR_BADGE_IDS_KEY).length);

  useEffect(() => {
    const syncCount = () => setCount(isSidebarBadgeMuted() ? 0 : readIds(SIDEBAR_BADGE_IDS_KEY).length);

    window.addEventListener(SIDEBAR_BADGE_IDS_EVENT, syncCount);
    window.addEventListener('storage', syncCount);

    return () => {
      window.removeEventListener(SIDEBAR_BADGE_IDS_EVENT, syncCount);
      window.removeEventListener('storage', syncCount);
    };
  }, []);

  return count;
}

export function useProfileNameMap(actorIds: string[]) {
  const uniqueActorIds = [...new Set(actorIds)].filter(Boolean).sort();

  return useQuery({
    queryKey: ['profileNameMap', uniqueActorIds],
    queryFn: async () => {
      if (uniqueActorIds.length === 0) return {};

      const uuidIds = uniqueActorIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      const emails = uniqueActorIds.filter((id) => id.includes('@'));
      const rows: Array<{ id: string; full_name?: string | null; email?: string | null }> = [];

      if (uuidIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uuidIds);

        if (error) throw error;
        rows.push(...(data || []));
      }

      if (emails.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('email', emails);

        if (error) throw error;
        rows.push(...(data || []));
      }

      return Object.fromEntries(rows.flatMap((profile) => {
        const label = profile.full_name || profile.email || 'Cliente';
        return [
          [profile.id, label],
          ...(profile.email ? [[profile.email, label]] : []),
        ];
      }));
    },
    enabled: uniqueActorIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSpecialClientOrderLogDiffs(orderIds: Array<string | number>) {
  const { session } = useSession();
  const { role, canView } = useCanViewClientOrders();
  const uniqueOrderIds = [...new Set(orderIds.map(String).filter(Boolean))].sort();

  return useQuery({
    queryKey: ['specialClientOrderLogDiffs', uniqueOrderIds, role?.role, role?.sucursal],
    queryFn: async () => {
      if (!session?.user.id || !canView || uniqueOrderIds.length === 0) return {};

      const logs = await fetchSpecialClientOrderLogRows(uniqueOrderIds);
      return buildSpecialClientOrderLogDiffs(logs);
    },
    enabled: !!session?.user.id && !!role && canView && uniqueOrderIds.length > 0,
    refetchInterval: uniqueOrderIds.length > 0 ? 5000 : false,
  });
}

function useCanViewClientOrders() {
  const { data: role } = useUserRole();
  return {
    role,
    canView: role?.role === 'super_admin' || role?.role === 'branch_admin',
  };
}

export function useSpecialClientOrders(status: SpecialClientOrderStatus = 'all') {
  const { session } = useSession();
  const { role, canView } = useCanViewClientOrders();

  return useQuery({
    queryKey: ['specialClientOrders', status, role?.role, role?.sucursal],
    queryFn: async () => {
      if (!session?.user.id || !canView) return [];

      let query = supabase
        .from('client_requisitions')
        .select(`
          *,
          clients(name),
          client_requisition_items(*, productos(nombre, empaque))
        `)
        .order('created_at', { ascending: false })
        // ponytail: latest 100; paginate when client order volume needs it.
        .limit(100);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching special client orders:', error);
        throw error;
      }

      return (data || []) as SpecialClientOrder[];
    },
    enabled: !!session?.user.id && !!role && canView,
    refetchInterval: status === 'pending' ? 5000 : false,
  });
}
