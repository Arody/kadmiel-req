
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabaseClient';
import type { Order } from '../hooks/useOrders';

const PDF_CONFIG = {
    orientation: 'p' as const,
    unit: 'mm' as const,
    format: [140, 216] as [number, number] // ~5.5 x 8.5 inches
};

// Helper: Fetch items for one or multiple orders
async function fetchItemsForOrders(orderIds: string[]) {
    const { data: items, error } = await supabase
        .from('orden_compra_detalles')
        .select(`
            order_id,
            cantidad,
            precio_unitario,
            productos (
                nombre,
                empaque,
                imagen_url
            )
        `)
        .in('order_id', orderIds);

    if (error) {
        console.error("Error fetching items", error);
        throw error;
    }
    return items || [];
}

// Helper: Convert URL to Base64
async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Could not load image", imageUrl);
        return null;
    }
}

// Core Render Logic
async function renderOrderToDoc(doc: jsPDF, order: Order, items: any[]) {
    // Header Info
    doc.setFontSize(14);
    doc.text('ORDEN DE PRODUCCIÓN', 70, 15, { align: 'center' }); 

    doc.setFontSize(10);
    doc.text(`Folio: #${order.folio}`, 10, 25);
    doc.text(`Fecha Entrega: ${order.delivery_date || 'Sin fecha'} ${order.delivery_time || ''}`, 75, 25);
    doc.text(`Cliente: ${order.customer_name}`, 10, 30);
    
    let startY = 38;
    if (order.notes) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        const splitNotes = doc.splitTextToSize(`Notas: ${order.notes}`, 120);
        doc.text(splitNotes, 10, 36);
        doc.setTextColor(0);
        startY = 36 + (splitNotes.length * 4) + 2; 
    }

    // Process rows with images
    const tableBody = await Promise.all(items.map(async (item: any) => {
        const product = item.productos;
        let imageData = null;

        if (product.imagen_url) {
            imageData = await getBase64ImageFromUrl(product.imagen_url);
        }

        return {
            image: imageData,
            imagePlaceholder: '',
            product: product.nombre,
            qty: item.cantidad,
            unit: product.empaque
        };
    }));

    autoTable(doc, {
        startY: startY,
        body: tableBody,
        columns: [
            { header: 'Img', dataKey: 'imagePlaceholder' },
            { header: 'Cant', dataKey: 'qty' },
            { header: 'Unidad', dataKey: 'unit' },
            { header: 'Producto', dataKey: 'product' }
        ],
        columnStyles: {
            imagePlaceholder: { cellWidth: 15, minCellHeight: 15 }, 
            qty: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, 
            unit: { cellWidth: 20 }, 
            product: { cellWidth: 'auto' } 
        },
        styles: { fontSize: 9, valign: 'middle' },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.dataKey === 'imagePlaceholder') {
                const rowRaw = data.row.raw as any;
                if (rowRaw && rowRaw.image) {
                     doc.addImage(rowRaw.image, 'JPEG', data.cell.x + 1, data.cell.y + 1, 13, 13);
                } else {
                     // Draw Gray Placeholder
                     doc.setFillColor(240, 240, 240);
                     doc.rect(data.cell.x + 1, data.cell.y + 1, 13, 13, 'F');
                }
            }
        }
    });
}

// Single Order Generator
export async function generateProductionPdf(order: Order) {
    try {
        const items = await fetchItemsForOrders([order.id]);
        if (items.length === 0) {
            alert("La orden no tiene productos.");
            return;
        }

        const doc = new jsPDF(PDF_CONFIG);
        await renderOrderToDoc(doc, order, items);
        doc.save(`Orden_Produccion_${order.folio}.pdf`);
    } catch (e) {
        alert("Error al generar PDF");
    }
}

// Batch Order Generator
export async function generateBatchProductionPdf(orders: Order[], dateRange?: { start?: string, end?: string }) {
    if (orders.length === 0) return;

    try {
        const orderIds = orders.map(o => o.id);
        const allItems = await fetchItemsForOrders(orderIds);

        // 1. Calculate Summary Totals
        const summaryTotals: Record<string, { qty: number, unit: string }> = {};
        allItems.forEach((item: any) => {
            const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
            const prodName = prod.nombre;
            // Normalize product names if needed, or stick to exact match
            if (!summaryTotals[prodName]) {
                summaryTotals[prodName] = { qty: 0, unit: prod.empaque };
            }
            summaryTotals[prodName].qty += item.cantidad;
        });

        // Group items by order for detailed listing
        const itemsByOrder: Record<string, any[]> = {};
        allItems.forEach(item => {
            if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
            itemsByOrder[item.order_id].push(item);
        });

        const doc = new jsPDF(PDF_CONFIG);
        let cursorY = 20;

        // 2. Render Summary Table
        doc.setFontSize(16);
        doc.text('RESUMEN DE PRODUCCIÓN', 140 / 2, cursorY, { align: 'center' });
        cursorY += 7;

        if (dateRange?.start && dateRange?.end) {
            doc.setFontSize(10);
            doc.text(`Periodo: ${dateRange.start} - ${dateRange.end}`, 140 / 2, cursorY, { align: 'center' });
            cursorY += 8;
        } else if (dateRange?.start) {
            doc.setFontSize(10);
            doc.text(`Desde: ${dateRange.start}`, 140 / 2, cursorY, { align: 'center' });
            cursorY += 8;
        }
        
        cursorY += 3; // Extra spacing

        const summaryBody = Object.entries(summaryTotals).map(([name, data]) => [
            data.qty,
            data.unit,
            name
        ]);

        autoTable(doc, {
            startY: cursorY,
            head: [['Cant Total', 'Unidad', 'Producto']],
            body: summaryBody,
            styles: { fontSize: 10, valign: 'middle' },
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] }
        });

        // Update cursor after summary
        // @ts-ignore
        cursorY = doc.lastAutoTable.finalY + 15;

        // 3. Render Orders Consecutively
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            const orderItems = itemsByOrder[order.id] || [];

            // Check if we need a page break for the header
            // Approx header height ~30mm. Page height 216mm.
            if (cursorY + 40 > 216) {
                doc.addPage();
                cursorY = 20;
            }

            // Draw Header
            doc.setFontSize(12);
            doc.setFillColor(240, 240, 240);
            doc.rect(10, cursorY - 5, 120, 8, 'F'); // Background bar
            doc.text(`Pedido #${order.folio} - ${order.customer_name}`, 12, cursorY);
            
            doc.setFontSize(9);
            const dateStr = `${order.delivery_date || ''} ${order.delivery_time || ''}`;
            doc.text(dateStr, 130, cursorY, { align: 'right' });
            
            cursorY += 5;

            if (order.notes) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                const splitNotes = doc.splitTextToSize(`Notas: ${order.notes}`, 120);
                doc.text(splitNotes, 12, cursorY + 3);
                doc.setTextColor(0);
                cursorY += (splitNotes.length * 4) + 2;
            }

            // Prepare items for this order
            const tableBody = await Promise.all(orderItems.map(async (item: any) => {
                const product = item.productos;
                let imageData = null;
                if (product.imagen_url) {
                    imageData = await getBase64ImageFromUrl(product.imagen_url);
                }
                return {
                    image: imageData, // Raw data for custom drawing
                    imagePlaceholder: '', // Empty string for the cell text
                    product: product.nombre,
                    qty: item.cantidad,
                    unit: product.empaque
                };
            }));

            if (tableBody.length > 0) {
                autoTable(doc, {
                    startY: cursorY + 2,
                    body: tableBody,
                    columns: [
                        { header: 'Img', dataKey: 'imagePlaceholder' }, // Use placeholder key
                        { header: 'Cant', dataKey: 'qty' },
                        { header: 'Unidad', dataKey: 'unit' },
                        { header: 'Producto', dataKey: 'product' }
                    ],
                    columnStyles: {
                        imagePlaceholder: { cellWidth: 12, minCellHeight: 12 }, 
                        qty: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 
                        unit: { cellWidth: 20 }, 
                        product: { cellWidth: 'auto' } 
                    },
                    styles: { fontSize: 8, valign: 'middle' },
                    margin: { left: 10, right: 10 },
                    pageBreak: 'auto',
                    didDrawCell: (data) => {
                        if (data.section === 'body' && data.column.dataKey === 'imagePlaceholder') {
                            const rowRaw = data.row.raw as any;
                            if (rowRaw && rowRaw.image) {
                                doc.addImage(rowRaw.image, 'JPEG', data.cell.x + 1, data.cell.y + 1, 10, 10);
                            } else {
                                // Draw Gray Placeholder
                                doc.setFillColor(240, 240, 240);
                                doc.rect(data.cell.x + 1, data.cell.y + 1, 10, 10, 'F');
                            }
                        }
                    }
                });
                
                // @ts-ignore
                cursorY = doc.lastAutoTable.finalY + 10; 
            } else {
                doc.setFontSize(8);
                doc.text("(Sin productos)", 12, cursorY + 5);
                cursorY += 15;
            }
        }

        doc.save(`Produccion_Consolidada_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
        console.error(e);
        alert("Error al generar reporte consolidado");
    }
}
