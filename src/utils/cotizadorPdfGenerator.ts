
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import data from '../data/cotizador.json';

const PDF_CONFIG = {
    orientation: 'p' as const,
    unit: 'mm' as const,
    format: [140, 216] as [number, number], // ~5.5 x 8.5 inches
};

type Mesa = {
    id: string;
    nombre: string;
    descripcionCorta: string;
    piezasPorPersona: number;
    incluye: string[];
    tamanios: { personas: number; piezas: number; precio: number }[];
    categorias: {
        id: string;
        titulo: string;
        opciones: { id: string; nombre: string; descripcion: string }[];
    }[];
};

const mesas: Mesa[] = data.mesas as Mesa[];

const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', {
        style: 'currency',
        currency: data.moneda,
        maximumFractionDigits: 0,
    });

const formatDate = (date: Date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}/${date.getFullYear()}`;
};

const addFooter = (doc: jsPDF, pageNum: number) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Línea separadora
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);

    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    doc.text('Kadmiel · Mesas de Postres', 10, pageHeight - 7);
    doc.text(`Página ${pageNum}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
    doc.setTextColor(0, 0, 0);
};

const addSectionTitle = (doc: jsPDF, title: string, y: number): number => {
    const pageWidth = doc.internal.pageSize.getWidth();
    // Fondo gris oscuro
    doc.setFillColor(40, 40, 40);
    doc.rect(10, y - 4.5, pageWidth - 20, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), 12, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    return y + 4;
};

export interface CotizacionData {
    mesaId: string;
    personasCustom: number;
    cliente: string;
    telefono: string;
    fechaEvento: string;
    selecciones: Record<string, string>;
    extras: string[];
}

export function generateCotizacionPdf(payload: CotizacionData) {
    const mesa = mesas.find((m) => m.id === payload.mesaId) ?? mesas[0];

    // Determinar el tier seleccionado
    const sortedTiers = [...mesa.tamanios].sort((a, b) => a.personas - b.personas);
    let chosen = sortedTiers[0];
    for (const t of sortedTiers) {
        if (t.personas <= payload.personasCustom) chosen = t;
    }
    const exactMatch = sortedTiers.some((t) => t.personas === payload.personasCustom);

    const doc = new jsPDF(PDF_CONFIG);
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = 12;
    let pageNum = 1;

    // ============== HEADER ==============
    // Banda superior color rosa (color de la marca)
    doc.setFillColor(236, 72, 153); // pink-500
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('COTIZACIÓN', pageWidth / 2, 9, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(data.titulo, pageWidth / 2, 15, { align: 'center' });

    // Folio y fechas
    cursorY = 28;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    const hoy = new Date();
    const validaHasta = new Date(hoy);
    validaHasta.setDate(validaHasta.getDate() + 30);

    doc.text('Folio:', 10, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.text(`COT-${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`, 22, cursorY);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', 75, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(hoy), 86, cursorY);

    doc.setFont('helvetica', 'bold');
    doc.text('Válida hasta:', 10, cursorY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(validaHasta), 30, cursorY + 4);

    cursorY += 10;

    // ============== CLIENTE ==============
    if (payload.cliente || payload.telefono || payload.fechaEvento) {
        cursorY = addSectionTitle(doc, 'Datos del Cliente', cursorY);

        doc.setFontSize(8.5);
        if (payload.cliente) {
            doc.setFont('helvetica', 'bold');
            doc.text('Cliente:', 10, cursorY);
            doc.setFont('helvetica', 'normal');
            doc.text(payload.cliente, 25, cursorY);
            cursorY += 4;
        }
        if (payload.telefono) {
            doc.setFont('helvetica', 'bold');
            doc.text('Teléfono:', 10, cursorY);
            doc.setFont('helvetica', 'normal');
            doc.text(payload.telefono, 25, cursorY);
            cursorY += 4;
        }
        if (payload.fechaEvento) {
            doc.setFont('helvetica', 'bold');
            doc.text('Evento:', 10, cursorY);
            doc.setFont('helvetica', 'normal');
            const fechaFmt = payload.fechaEvento.split('-').reverse().join('/');
            doc.text(fechaFmt, 25, cursorY);
            cursorY += 4;
        }
        cursorY += 3;
    }

    // ============== MESA ==============
    cursorY = addSectionTitle(doc, 'Mesa Seleccionada', cursorY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(236, 72, 153);
    doc.text(mesa.nombre, 10, cursorY);
    doc.setTextColor(0, 0, 0);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Tamaño: ${chosen.personas} personas`, 10, cursorY);
    doc.text(`(${chosen.piezas} piezas totales)`, 50, cursorY);
    cursorY += 4;
    doc.text(`Distribución: ${mesa.piezasPorPersona} piezas por persona`, 10, cursorY);
    cursorY += 4;

    if (!exactMatch) {
        doc.setFontSize(7.5);
        doc.setTextColor(120, 80, 0);
        const nota = `Cotización para ${payload.personasCustom} invitados — se aplica el paquete de ${chosen.personas} personas.`;
        const split = doc.splitTextToSize(nota, pageWidth - 20);
        doc.text(split, 10, cursorY);
        doc.setTextColor(0, 0, 0);
        cursorY += split.length * 3.5;
    }
    cursorY += 3;

    // ============== VARIEDADES ==============
    cursorY = addSectionTitle(doc, 'Variedades Seleccionadas', cursorY);

    const variedadesRows = mesa.categorias.map((cat) => {
        const op = cat.opciones.find((o) => o.id === payload.selecciones[cat.id]);
        return [
            cat.titulo,
            op ? op.nombre : '—',
            op?.descripcion ? doc.splitTextToSize(op.descripcion, 70) : '—',
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        body: variedadesRows,
        styles: { fontSize: 7.5, valign: 'top', cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 35, fontStyle: 'bold', textColor: [80, 80, 80] },
            1: { cellWidth: 35 },
            2: { cellWidth: 'auto', textColor: [120, 120, 120] },
        },
        theme: 'plain',
        didDrawCell: (data) => {
            if (data.section === 'body' && data.row.index < variedadesRows.length - 1) {
                // Línea separadora sutil entre filas
                const y = data.cell.y + data.cell.height;
                doc.setDrawColor(230, 230, 230);
                doc.setLineWidth(0.1);
                doc.line(10, y, pageWidth - 10, y);
            }
        },
        margin: { left: 10, right: 10 },
    });

    // @ts-ignore
    cursorY = doc.lastAutoTable.finalY + 6;

    // ============== EXTRAS ==============
    if (payload.extras.length > 0) {
        if (cursorY + 30 > 200) {
            addFooter(doc, pageNum);
            doc.addPage();
            pageNum++;
            cursorY = 12;
        }
        cursorY = addSectionTitle(doc, 'Decoración Extra', cursorY);

        const extrasRows = data.extras
            .filter((e) => payload.extras.includes(e.id))
            .map((e) => [e.nombre]);

        autoTable(doc, {
            startY: cursorY,
            body: extrasRows,
            styles: { fontSize: 8, cellPadding: 1.2 },
            columnStyles: { 0: { cellWidth: 'auto' } },
            theme: 'plain',
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 0) {
                    data.cell.text = [`•  ${data.cell.text}`];
                }
            },
            margin: { left: 10, right: 10 },
        });
        // @ts-ignore
        cursorY = doc.lastAutoTable.finalY + 4;
    }

    // ============== TOTAL ==============
    if (cursorY + 25 > 200) {
        addFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        cursorY = 12;
    }

    // Caja destacada del total
    doc.setFillColor(254, 243, 244); // pink-50
    doc.setDrawColor(236, 72, 153);
    doc.setLineWidth(0.4);
    doc.roundedRect(10, cursorY, pageWidth - 20, 22, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 80, 100);
    doc.text('TOTAL DE LA COTIZACIÓN', pageWidth / 2, cursorY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text(formatCurrency(chosen.precio), pageWidth / 2, cursorY + 14, { align: 'center' });

    cursorY += 25;

    // Desglose de pagos
    const anticipo = chosen.precio * 0.5;
    const restante = chosen.precio - anticipo;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    const desgloseY = cursorY;
    doc.text('Anticipo (50%):', 18, desgloseY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(anticipo), 50, desgloseY);

    doc.setFont('helvetica', 'normal');
    doc.text('Restante (15 días antes):', 75, desgloseY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(restante), 122, desgloseY, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    cursorY += 8;

    // ============== INCLUYE ==============
    if (cursorY + 40 > 200) {
        addFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        cursorY = 12;
    }
    cursorY = addSectionTitle(doc, 'La Mesa Incluye', cursorY);

    doc.setFontSize(7.5);
    const incluyeLines = mesa.incluye.map((line) => `•  ${line}`);
    const splitIncluye = doc.splitTextToSize(incluyeLines.join('\n'), pageWidth - 22);
    doc.text(splitIncluye, 11, cursorY);
    cursorY += splitIncluye.length * 3.2 + 3;

    // ============== PROCESO DE COMPRA ==============
    if (cursorY + 50 > 200) {
        addFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        cursorY = 12;
    }
    cursorY = addSectionTitle(doc, 'Proceso de Compra', cursorY);

    doc.setFontSize(7.2);
    const proceso = data.procesoCompra.map((p, i) => `${i + 1}.  ${p}`);
    const splitProceso = doc.splitTextToSize(proceso.join('\n'), pageWidth - 22);
    doc.text(splitProceso, 11, cursorY);
    cursorY += splitProceso.length * 3 + 3;

    // ============== NOTA FINAL ==============
    if (cursorY + 12 > 200) {
        addFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        cursorY = 12;
    }

    doc.setDrawColor(236, 72, 153);
    doc.setLineWidth(0.3);
    doc.line(10, cursorY, pageWidth - 10, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 80, 100);
    doc.text('¡Gracias por permitirnos ser parte de su celebración!', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Precios sujetos a cambio sin previo aviso. Esta cotización no representa un compromiso de compra.', pageWidth / 2, cursorY, { align: 'center' });

    // Footer de la última página
    addFooter(doc, pageNum);

    // Guardar
    const filename = `Cotizacion_${mesa.nombre.replace(/\s+/g, '_')}_${chosen.personas}pax_${formatDate(hoy).replace(/\//g, '-')}.pdf`;
    doc.save(filename);
}
