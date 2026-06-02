import { useEffect, useMemo, useState } from 'react';
import {
  Cake,
  Sparkles,
  Gem,
  Users,
  Check,
  Copy,
  FileDown,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
  Receipt,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../lib/utils';
import data from '../../data/cotizador.json';
import { generateCotizacionPdf } from '../../utils/cotizadorPdfGenerator';

type Opcion = { id: string; nombre: string; descripcion: string };
type Categoria = {
  id: string;
  titulo: string;
  instruccion: string;
  opciones: Opcion[];
};
type Tamanio = { personas: number; piezas: number; precio: number };
type Mesa = {
  id: string;
  nombre: string;
  descripcionCorta: string;
  piezasPorPersona: number;
  incluye: string[];
  tamanios: Tamanio[];
  categorias: Categoria[];
};

const mesas: Mesa[] = data.mesas;

const formatCurrency = (value: number) =>
  value.toLocaleString('es-MX', {
    style: 'currency',
    currency: data.moneda,
    maximumFractionDigits: 0,
  });

/**
 * Selecciona el tier más cercano al número de invitados.
 * Regla: el mayor tier estándar que sea <= N, con tope en el tier máximo disponible.
 * Ejemplos con tiers [50, 100, 150]:
 *   99  → 50   (99 > 50 pero 99 < 100, así que el mayor tier <= 99 es 50)
 *   120 → 100
 *   175 → 150
 */
const pickTierIndex = (n: number, tamanios: Tamanio[]): number => {
  if (n <= 0 || tamanios.length === 0) return 0;
  const sorted = [...tamanios]
    .map((t, idx) => ({ idx, personas: t.personas }))
    .sort((a, b) => a.personas - b.personas);
  let chosenIdx = sorted[0].idx;
  for (const item of sorted) {
    if (item.personas <= n) chosenIdx = item.idx;
  }
  return chosenIdx;
};

export function Cotizador() {
  // Selecciones
  const [mesaId, setMesaId] = useState<string>('premium');
  const [tamanioIdx, setTamanioIdx] = useState<number>(0);
  const [personasCustom, setPersonasCustom] = useState<number>(50);
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Datos del cliente
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [showProceso, setShowProceso] = useState(false);

  // Persistencia ligera
  useEffect(() => {
    const saved = localStorage.getItem('COTIZADOR_STATE');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setMesaId(p.mesaId ?? 'premium');
        const restoredTamanioIdx = p.tamanioIdx ?? 0;
        setTamanioIdx(restoredTamanioIdx);
        const restoredPersonas =
          typeof p.personasCustom === 'number'
            ? p.personasCustom
            : (mesas[0].tamanios[restoredTamanioIdx]?.personas ?? 50);
        setPersonasCustom(restoredPersonas);
        setSelecciones(p.selecciones ?? {});
        setExtras(p.extras ?? []);
        setCliente(p.cliente ?? '');
        setTelefono(p.telefono ?? '');
        setFechaEvento(p.fechaEvento ?? '');
      } catch (e) {
        console.error('No se pudo restaurar el cotizador', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'COTIZADOR_STATE',
      JSON.stringify({
        mesaId,
        tamanioIdx,
        personasCustom,
        selecciones,
        extras,
        cliente,
        telefono,
        fechaEvento,
      })
    );
  }, [mesaId, tamanioIdx, personasCustom, selecciones, extras, cliente, telefono, fechaEvento]);

  const mesa = useMemo(
    () => mesas.find((m) => m.id === mesaId) ?? mesas[0],
    [mesaId]
  );
  const tamanio = mesa.tamanios[tamanioIdx];
  const exactMatch = mesa.tamanios[tamanioIdx]?.personas === personasCustom;

  const totalCategoriasCompletas = mesa.categorias.every(
    (c) => selecciones[c.id]
  );

  const handleMesaChange = (id: string) => {
    setMesaId(id);
    setTamanioIdx(0);
    setPersonasCustom(mesas.find((m) => m.id === id)?.tamanios[0].personas ?? 50);
    setSelecciones({});
  };

  const handlePersonasChange = (value: number) => {
    const n = isNaN(value) || value < 1 ? 0 : value;
    setPersonasCustom(n);
    setTamanioIdx(pickTierIndex(n, mesa.tamanios));
  };

  const handleTamanioClick = (idx: number) => {
    setTamanioIdx(idx);
    setPersonasCustom(mesa.tamanios[idx].personas);
  };

  const handleReset = () => {
    if (confirm('¿Deseas limpiar toda la cotización?')) {
      setMesaId('premium');
      setTamanioIdx(0);
      setPersonasCustom(mesas[0].tamanios[0].personas);
      setSelecciones({});
      setExtras([]);
      setCliente('');
      setTelefono('');
      setFechaEvento('');
    }
  };

  const handleGeneratePdf = () => {
    try {
      setGeneratingPdf(true);
      generateCotizacionPdf({
        mesaId,
        personasCustom,
        cliente,
        telefono,
        fechaEvento,
        selecciones,
        extras,
      });
    } catch (e) {
      console.error('Error al generar PDF', e);
      alert('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleCopy = () => {
    const lineas: string[] = [];
    lineas.push(`*Cotización Mesa de Postres - ${data.titulo}*`);
    lineas.push('');
    lineas.push(`Mesa: ${mesa.nombre}`);
    lineas.push(
      `Tamaño: ${tamanio.personas} personas (${tamanio.piezas} piezas)`
    );
    if (!exactMatch && personasCustom > 0) {
      lineas.push(`(Cotizado para ${personasCustom} invitados)`);
    }
    lineas.push('');
    lineas.push('*Postres incluidos:*');
    mesa.categorias.forEach((cat) => {
      const op = cat.opciones.find((o) => o.id === selecciones[cat.id]);
      lineas.push(`• ${cat.titulo}: ${op?.nombre ?? '—'}`);
    });
    if (extras.length > 0) {
      lineas.push('');
      lineas.push('*Extras:*');
      data.extras
        .filter((e) => extras.includes(e.id))
        .forEach((e) => lineas.push(`• ${e.nombre}`));
    }
    if (cliente || telefono || fechaEvento) {
      lineas.push('');
      lineas.push('*Datos del cliente:*');
      if (cliente) lineas.push(`Cliente: ${cliente}`);
      if (telefono) lineas.push(`Teléfono: ${telefono}`);
      if (fechaEvento) lineas.push(`Fecha: ${fechaEvento}`);
    }
    lineas.push('');
    lineas.push(`*TOTAL: ${formatCurrency(tamanio.precio)}*`);
    lineas.push('');
    lineas.push('Precios sujetos a cambio sin previo aviso.');

    navigator.clipboard.writeText(lineas.join('\n'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Cake className="h-6 w-6 text-pink-500" />
            Cotizador de Mesas de Postres
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Arma la cotización de la mesa ideal para tu evento. Los precios se
            calculan en tiempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reiniciar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Paso 1: Tipo de mesa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">
                  1
                </span>
                Elige el tipo de mesa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mesas.map((m) => {
                  const isActive = m.id === mesaId;
                  const Icon = m.id === 'premium' ? Sparkles : Gem;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleMesaChange(m.id)}
                      className={cn(
                        'text-left p-4 rounded-lg border-2 transition-all relative',
                        isActive
                          ? 'border-gray-900 bg-gray-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      )}
                    >
                      {isActive && (
                        <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-gray-900" />
                      )}
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                            m.id === 'premium'
                              ? 'bg-pink-100 text-pink-700'
                              : 'bg-purple-100 text-purple-700'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">
                            {m.nombre}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {m.piezasPorPersona} piezas por persona
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Desde{' '}
                            <span className="font-semibold text-gray-700">
                              {formatCurrency(m.tamanios[0].precio)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Incluye */}
              <details className="mt-4 group">
                <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-900 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  ¿Qué incluye la {mesa.nombre.toLowerCase()}?
                </summary>
                <ul className="mt-2 ml-5 list-disc text-xs text-gray-600 space-y-1">
                  {mesa.incluye.map((linea, idx) => (
                    <li key={idx}>{linea}</li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>

          {/* Paso 2: Tamaño */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">
                  2
                </span>
                Selecciona el tamaño
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                <Label
                  htmlFor="personas-input"
                  className="text-xs text-gray-600"
                >
                  Número de invitados
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="personas-input"
                    type="number"
                    min={1}
                    value={personasCustom || ''}
                    onChange={(e) =>
                      handlePersonasChange(parseInt(e.target.value))
                    }
                    placeholder="Ej. 120"
                    className="h-9 max-w-[140px]"
                  />
                  <span className="text-sm text-gray-600">personas</span>
                </div>
                {!exactMatch && personasCustom > 0 && (
                  <p className="text-xs text-amber-700 mt-2 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      Para {personasCustom} invitados se cotiza el paquete de{' '}
                      <span className="font-semibold">
                        {tamanio.personas} personas
                      </span>
                      .
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {mesa.tamanios.map((t, idx) => {
                  const isActive = idx === tamanioIdx;
                  return (
                    <button
                      key={t.personas}
                      onClick={() => handleTamanioClick(idx)}
                      className={cn(
                        'p-4 rounded-lg border-2 transition-all text-left',
                        isActive
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      )}
                    >
                      <div className="flex items-center gap-2 text-gray-700">
                        <Users className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                          {t.personas} personas
                        </span>
                      </div>
                      <div className="mt-2 text-2xl font-bold text-gray-900">
                        {formatCurrency(t.precio)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t.piezas} piezas totales
                      </p>
                      {isActive && (
                        <div className="mt-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-gray-900">
                          <Check className="mr-1 h-3 w-3" />
                          Seleccionado
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Paso 3: Selecciones por categoría */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">
                  3
                </span>
                Personaliza tus variedades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {mesa.categorias.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-900">
                      {cat.titulo}
                    </h4>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      {cat.instruccion}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {cat.opciones.map((op) => {
                      const isActive = selecciones[cat.id] === op.id;
                      return (
                        <button
                          key={op.id}
                          onClick={() =>
                            setSelecciones((s) => ({ ...s, [cat.id]: op.id }))
                          }
                          className={cn(
                            'text-left p-3 rounded-md border transition-all',
                            isActive
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 bg-white hover:border-gray-400'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  'font-medium text-sm',
                                  isActive ? 'text-white' : 'text-gray-900'
                                )}
                              >
                                {op.nombre}
                              </p>
                              {op.descripcion && (
                                <p
                                  className={cn(
                                    'text-xs mt-0.5 leading-snug',
                                    isActive ? 'text-gray-300' : 'text-gray-500'
                                  )}
                                >
                                  {op.descripcion}
                                </p>
                              )}
                            </div>
                            {isActive && (
                              <Check className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Paso 4: Extras */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">
                  4
                </span>
                Decoración extra (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-3">
                Con costo adicional. Cotizar por separado al cierre.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.extras.map((ex) => {
                  const isActive = extras.includes(ex.id);
                  return (
                    <button
                      key={ex.id}
                      onClick={() =>
                        setExtras((arr) =>
                          arr.includes(ex.id)
                            ? arr.filter((x) => x !== ex.id)
                            : [...arr, ex.id]
                        )
                      }
                      className={cn(
                        'p-3 rounded-md border text-sm text-left transition-all flex items-center gap-2',
                        isActive
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 bg-white hover:border-gray-400'
                      )}
                    >
                      <div
                        className={cn(
                          'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                          isActive
                            ? 'bg-gray-900 border-gray-900'
                            : 'border-gray-300'
                        )}
                      >
                        {isActive && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-gray-800">{ex.nombre}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Datos del cliente */}
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer"
              onClick={() => setCliente((c) => c || '')}
            >
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">
                  5
                </span>
                Datos del cliente (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">
                    Cliente
                  </Label>
                  <Input
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Nombre completo"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">
                    Teléfono
                  </Label>
                  <Input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="ej. 961..."
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">
                    Fecha del evento
                  </Label>
                  <Input
                    type="date"
                    value={fechaEvento}
                    onChange={(e) => setFechaEvento(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar resumen */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-pink-900">
                  <Receipt className="h-4 w-4" />
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                    Mesa
                  </p>
                  <p className="font-semibold text-gray-900">{mesa.nombre}</p>
                </div>
                <div className="text-sm flex items-start gap-2">
                  <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {tamanio.personas} personas
                    </p>
                    <p className="text-xs text-gray-500">
                      {tamanio.piezas} piezas · {mesa.piezasPorPersona} por
                      persona
                    </p>
                    {!exactMatch && personasCustom > 0 && (
                      <p className="text-[10px] text-amber-700 mt-1 italic">
                        Cotizado para {personasCustom} invitados
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-pink-200 pt-3 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                    Variedades
                  </p>
                  {mesa.categorias.map((cat) => {
                    const op = cat.opciones.find(
                      (o) => o.id === selecciones[cat.id]
                    );
                    return (
                      <div
                        key={cat.id}
                        className="flex items-start gap-2 text-xs"
                      >
                        {op ? (
                          <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-gray-500">{cat.titulo}</p>
                          <p
                            className={cn(
                              'font-medium',
                              op ? 'text-gray-900' : 'text-gray-400 italic'
                            )}
                          >
                            {op ? op.nombre : 'Pendiente'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {extras.length > 0 && (
                  <div className="border-t border-pink-200 pt-3 space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                      Extras
                    </p>
                    {data.extras
                      .filter((e) => extras.includes(e.id))
                      .map((e) => (
                        <p
                          key={e.id}
                          className="text-xs text-gray-700 flex items-center gap-1.5"
                        >
                          <span className="h-1.5 w-1.5 bg-pink-500 rounded-full" />
                          {e.nombre}
                        </p>
                      ))}
                  </div>
                )}

                {(cliente || telefono || fechaEvento) && (
                  <div className="border-t border-pink-200 pt-3 space-y-1">
                    {cliente && (
                      <p className="text-xs text-gray-700">
                        <span className="text-gray-500">Cliente: </span>
                        {cliente}
                      </p>
                    )}
                    {telefono && (
                      <p className="text-xs text-gray-700">
                        <span className="text-gray-500">Tel: </span>
                        {telefono}
                      </p>
                    )}
                    {fechaEvento && (
                      <p className="text-xs text-gray-700 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {fechaEvento}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-pink-200 pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-2xl font-bold text-gray-900 tracking-tight">
                      {formatCurrency(tamanio.precio)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Anticipo 50% · Liquidación 15 días antes del evento
                  </p>
                </div>

                {!totalCategoriasCompletas && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      Completa las variedades para finalizar la cotización.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!totalCategoriasCompletas}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={!totalCategoriasCompletas || generatingPdf}
                    className="bg-pink-600 hover:bg-pink-700 text-white"
                  >
                    {generatingPdf ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {generatingPdf ? 'Generando…' : 'Descargar PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Proceso de compra */}
            <Card>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => setShowProceso(!showProceso)}
              >
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-gray-700">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Proceso de compra
                  </span>
                  {showProceso ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CardTitle>
              </CardHeader>
              {showProceso && (
                <CardContent>
                  <ol className="text-xs text-gray-600 space-y-2 list-decimal pl-4">
                    {data.procesoCompra.map((linea, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {linea}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
