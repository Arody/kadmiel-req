
import { useStock, type StockItem } from '../../hooks/useStock';
import { useUserRole } from '../../hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Save, Pencil, PlusCircle, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCreateProduct } from '../../hooks/useCreateProduct';
import { useUpdateProduct } from '../../hooks/useUpdateProduct';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { useCampaigns } from '../../hooks/useCampaigns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useProductCategories } from '../../hooks/useProductCategories';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { urlToPngDataUrl } from '../../utils/imageUtils';
import { FileSpreadsheet } from 'lucide-react';
// --- Product Dialog Component (Shared for Create/Edit) ---
type ProductDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productToEdit?: StockItem | null; // Pass full stock item to extract product details
};

const REQUISITION_ROW_HEIGHT = 78;
const REQUISITION_IMAGE_MAX_WIDTH = 112;
const REQUISITION_IMAGE_MAX_HEIGHT = 88;

function getContainedImageSize(width: number, height: number) {
  const scale = Math.min(REQUISITION_IMAGE_MAX_WIDTH / width, REQUISITION_IMAGE_MAX_HEIGHT / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function ProductDialog({ open, onOpenChange, productToEdit }: ProductDialogProps) {
  const { mutate: createProduct, isPending: isCreating } = useCreateProduct();
  const { mutate: updateProduct, isPending: isUpdating } = useUpdateProduct();
  const { data: campaigns } = useCampaigns();
  
  const isEditing = !!productToEdit;
  const isPending = isCreating || isUpdating;

  // Initial State
  const initialFormState = {
      nombre: '',
      empaque: 'Unidad',
      precio: '',
      descripcion: '',
      catalogo: 'General',
      categoria: '',
      subcategoria: '',
      category_id: '',
      subcategory_id: '',
      tipo: '-',
      campaign_id: '',
      is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);
  const [imageFile, setImageFile] = useState<File | null>(null);
    const { data: categories = [], isLoading: isLoadingCategories } = useProductCategories();

  // Load data when editing
  useEffect(() => {
      if (productToEdit && productToEdit.productos) {
           const p = productToEdit as any; 
           setFormData({
              nombre: p.productos?.nombre || '',
              empaque: p.productos?.empaque || 'Unidad',
              precio: p.productos?.precio || '',
              descripcion: p.productos?.descripcion || '',
              catalogo: p.productos?.catalogo || 'General',
               categoria: p.productos?.categoria || '',
               subcategoria: p.productos?.subcategoria || '',
               category_id: p.productos?.category_id || '',
               subcategory_id: p.productos?.subcategory_id || '',
               tipo: p.productos?.tipo || '-',
              campaign_id: p.productos?.campaign_id || '',
              is_active: p.productos?.is_active ?? true
           });
      } else {
          // Set default category if available
          if (categories.length > 0 && !formData.categoria) {
              const firstCat = categories[0];
              const firstSub = firstCat.subcategories[0];
              setFormData(prev => ({
                  ...prev,
                  ...initialFormState,
                  categoria: firstCat.name,
                  category_id: firstCat.id,
                  subcategoria: firstSub?.name || '',
                  subcategory_id: firstSub?.id || ''
              }));
          } else {
                setFormData(initialFormState);
            }
      }
      setImageFile(null);
  }, [productToEdit, open, categories]); // Added categories dependency to set default

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const price = parseFloat(formData.precio.toString());
      if (isNaN(price)) {
          alert("Por favor ingrese un precio válido");
          return;
      }

      const payload = {
          nombre: formData.nombre,
          empaque: formData.empaque,
          precio: price,
          descripcion: formData.descripcion,
          catalogo: formData.catalogo,
          categoria: formData.categoria,
          subcategoria: formData.subcategoria,
          category_id: formData.category_id || undefined,
          subcategory_id: formData.subcategory_id || undefined,
          tipo: formData.tipo,
          campaign_id: formData.campaign_id ? Number(formData.campaign_id) : null,
          is_active: formData.is_active,
          imageFile: imageFile
      };

      const options = {
          onSuccess: () => {
              onOpenChange(false);
              setFormData(initialFormState);
              setImageFile(null);
          },
          onError: (error: any) => {
              console.error("Error updating product:", error);
              alert(`Error al guardar: ${error.message || error}`);
          }
      };

      if (isEditing && productToEdit) {
          updateProduct({ ...payload, id: productToEdit.product_id }, options);
      } else {
          createProduct(payload, options);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Producto' : 'Agregar Nuevo Producto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="flex items-center space-x-4 mb-4">
                     <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                        />
                        <Label htmlFor="is_active">Producto Activo</Label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                        <Label>Nombre del Producto *</Label>
                        <Input 
                            required
                            value={formData.nombre}
                            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                            placeholder="Ej. Conchas de Vainilla"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Precio Base *</Label>
                        <div className="relative">
                            <span className="absolute left-2 top-2.5 text-gray-400">$</span>
                            <Input 
                                type="number" 
                                required
                                className="pl-6"
                                value={formData.precio}
                                onChange={(e) => setFormData({...formData, precio: e.target.value})}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Unidad / Empaque *</Label>
                        <Input 
                            required
                            value={formData.empaque}
                            onChange={(e) => setFormData({...formData, empaque: e.target.value})}
                            placeholder="Ej. Pieza, Caja, Kg"
                        />
                    </div>
                    
                    <div className="space-y-2 col-span-2">
                        <Label>Imagen del Producto</Label>
                        <Input 
                            key={imageFile ? 'has-file' : 'no-file'} // Reset input on clear
                            type="file"
                            accept="image/*"
                            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                            className="cursor-pointer"
                        />
                         <p className="text-xs text-gray-500">
                             {isEditing ? 'Subir para reemplazar la actual.' : "Se subirá a 'imagenes-productos'."}
                         </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Campaña</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.campaign_id}
                            onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
                        >
                            <option value="">Sin Campaña</option>
                            {campaigns?.map(c => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Catálogo</Label>
                        <Input 
                            value={formData.catalogo}
                            onChange={(e) => setFormData({...formData, catalogo: e.target.value})}
                            placeholder="Ej. General, Temporada"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Categoría</Label>
                          {isLoadingCategories ? (
                              <div className="text-sm text-gray-500">Cargando categorías...</div>
                          ) : (
                                  <select
                                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      value={formData.category_id || ''}
                                      onChange={(e) => {
                                      const newCatId = e.target.value;
                                      const newCat = categories.find(c => c.id === newCatId);
                                      const subcats = newCat?.subcategories || [];
                                      const firstSub = subcats[0];

                                      setFormData({
                                          ...formData,
                                          categoria: newCat?.name || '',
                                          category_id: newCatId,
                                          subcategoria: firstSub?.name || '',
                                          subcategory_id: firstSub?.id || '',
                                      });
                                      }}
                                  >
                                      <option value="" disabled>Seleccionar Categoría</option>
                                      {categories.map(cat => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                      ))}
                                  </select>
                          )}
                    </div>
                    <div className="space-y-2">
                        <Label>Subcategoría</Label>
                          <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={formData.subcategory_id || ''}
                              onChange={(e) => {
                                  const newSubId = e.target.value;
                                  const currentCat = categories.find(c => c.id === formData.category_id);
                                  const newSub = currentCat?.subcategories.find(s => s.id === newSubId);

                                  setFormData({
                                      ...formData,
                                      subcategoria: newSub?.name || '',
                                      subcategory_id: newSubId
                                  })
                              }}
                              disabled={!formData.category_id}
                          >
                              <option value="" disabled>Seleccionar Subcategoría</option>
                              {categories
                                  .find(c => c.id === formData.category_id)
                                  ?.subcategories.map(sub => (
                                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                          </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Input 
                            value={formData.tipo}
                            onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                            placeholder="Ej. Panadería mexicana"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Descripción (Opcional)</Label>
                    <Input 
                        value={formData.descripcion}
                        onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                        placeholder="Detalles adicionales..."
                    />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Guardando...' : (isEditing ? 'Actualizar Producto' : 'Crear Producto')}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  );
}

// --- Modified StockRow with Edit Button and Selection ---
function StockRow({ item, onSave, onEdit, selectionMode, isSelected, onToggleSelect }: { item: StockItem, onSave: (id: string, qty: number) => Promise<void>, onEdit: (item: StockItem) => void, selectionMode?: boolean, isSelected?: boolean, onToggleSelect?: (id: string, selected: boolean) => void }) {
  const [qty, setQty] = useState(item.quantity);
  const [saving, setSaving] = useState(false);
  
  const hasChanged = qty !== item.quantity;


  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(item.id, qty);
    } finally {
      setSaving(false);
    }
  }

    const isOutOfStock = item.quantity === 0;
    const isLowStock = item.quantity <= 3 && item.quantity > 0;

  return (
      <div className={`flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50 transition-colors 
        ${isOutOfStock ? 'bg-red-50 border-l-4 border-l-red-500' : ''}
        ${isLowStock ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}
        ${isSelected ? 'bg-blue-50/50' : ''}
    `}>
          {selectionMode && onToggleSelect && (
            <div className="pl-2 pr-4">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                checked={isSelected || false}
                onChange={(e) => onToggleSelect(item.product_id.toString(), e.target.checked)}
              />
            </div>
          )}
          <div className="flex-1 pl-2">
          <div className="flex items-center gap-2">
                  <h4 className={`font-medium ${isOutOfStock ? 'text-red-900' : 'text-gray-900'}`}>
                      {item.productos?.nombre || `Producto #${item.product_id}`}
                  </h4>
                  {isOutOfStock && <span className="text-xs font-bold text-red-600 border border-red-200 bg-red-100 px-2 py-0.5 rounded-full">AGOTADO</span>}
                  {isLowStock && <span className="text-xs font-bold text-yellow-700 border border-yellow-200 bg-yellow-100 px-2 py-0.5 rounded-full">BAJO STOCK</span>}

              <button onClick={() => onEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Editar Producto">
                  <Pencil className="h-3 w-3" />
              </button>
          </div>
          <p className="text-sm text-gray-500">{item.productos?.empaque || 'Sin unidad'}</p>
       </div>
       <div className="flex items-center gap-3">
          <Input 
             type="number" 
                  className={`w-24 text-right ${isOutOfStock ? 'border-red-300 text-red-900 focus-visible:ring-red-500' : ''}`}
             value={qty} 
             onChange={(e) => setQty(Number(e.target.value))}
          />

          {hasChanged && (
            <Button size="icon" className="h-6 w-6" onClick={handleSave} disabled={saving}>
               {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          )}
       </div>
    </div>
  )
}

export function StockManager() {
  const { data: stock, isLoading, updateStock } = useStock();
  const { data: role } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<StockItem | null>(null);

  // Requisition mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForRequisition, setSelectedForRequisition] = useState<string[]>([]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const toggleSelection = (productId: string, selected: boolean) => {
    setSelectedForRequisition(prev => 
      selected ? [...prev, productId] : prev.filter(id => id !== productId)
    );
  };

  const handleEdit = (item: StockItem) => {
      setProductToEdit(item);
      setIsDialogOpen(true);
  };

  const handleCreate = () => {
      setProductToEdit(null);
      setIsDialogOpen(true);
  };

  const handleDownloadPDF = () => {
    if (!stock) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Catálogo de Productos - Kadmiel', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    // Filter valid products and map to rows
    const rows = stock
      .filter(item => item.productos) // Ensure product data exists
      .sort((a, b) => a.productos.nombre.localeCompare(b.productos.nombre))
      .map(item => [
          item.product_id,
          item.productos.nombre,
          `$${Number(item.productos.precio || 0).toFixed(2)}`
      ]);

    autoTable(doc, {
        head: [['ID', 'Nombre del Producto', 'Precio']],
        body: rows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] }, // Dark gray
        styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save('productos-kadmiel.pdf');
  };

  const handleExportExcel = async () => {
    if (!stock || selectedForRequisition.length === 0) return;
    setIsExportingExcel(true);
    
    try {
      const selectedItems = stock.filter(item => selectedForRequisition.includes(item.product_id.toString()));
      selectedItems.sort((a, b) => a.productos.nombre.localeCompare(b.productos.nombre));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Requisición', {
          properties: { defaultRowHeight: REQUISITION_ROW_HEIGHT },
          pageSetup: {
            paperSize: 1 as ExcelJS.PaperSize,
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            printTitlesRow: '7:7',
            margins: {
              left: 0.25,
              right: 0.25,
              top: 0.35,
              bottom: 0.35,
              header: 0.15,
              footer: 0.15,
            },
          },
      });

      // Column widths
      worksheet.getColumn(1).width = 8;  // #
      worksheet.getColumn(2).width = 40; // Producto
      worksheet.getColumn(3).width = 15; // Cantidad
      worksheet.getColumn(4).width = 25; // Imagen

      // Add Header texts
      worksheet.mergeCells('A1:D1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'KADMIEL - REQUISICIÓN NAVIDAD';
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      
      worksheet.getCell('A2').value = 'Folios:';
      worksheet.getCell('A2').font = { bold: true };
      worksheet.getCell('B2').value = '____________________';
      
      worksheet.getCell('A3').value = 'Fecha:';
      worksheet.getCell('A3').font = { bold: true };
      worksheet.getCell('B3').value = '____________________';
      
      worksheet.getCell('A4').value = 'Nombre:';
      worksheet.getCell('A4').font = { bold: true };
      worksheet.getCell('B4').value = '____________________';
      
      worksheet.getCell('A5').value = 'Sucursal:';
      worksheet.getCell('A5').font = { bold: true };
      worksheet.getCell('B5').value = role?.sucursal || '____________________';

      // Table headers row 7
      const headerRow = worksheet.getRow(7);
      headerRow.values = ['#', 'Producto', 'Cantidad', 'Imagen'];
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 30;

      // Table styling - headers
      ['A', 'B', 'C', 'D'].forEach(col => {
        const cell = worksheet.getCell(`${col}7`);
        cell.border = {
          top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
        };
      });

      // Iterate selected items starting from row 8
      let currentRowIndex = 8;

      for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          const row = worksheet.getRow(currentRowIndex);
          row.height = REQUISITION_ROW_HEIGHT;
          
          row.getCell(1).value = i + 1;
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
          
          row.getCell(2).value = item.productos.nombre;
          row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
          
          row.getCell(3).value = '';
          row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
          
          // Add border to cells
          ['A', 'B', 'C', 'D'].forEach(col => {
            worksheet.getCell(`${col}${currentRowIndex}`).border = {
              top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
            };
          });

          // Fetch and embed image if available
          const imgUrl = item.productos?.imagen_url;
          if (imgUrl && !imgUrl.includes('placehold')) {
              try {
                 const pngImage = await urlToPngDataUrl(imgUrl);
                 const imageSize = getContainedImageSize(pngImage.width, pngImage.height);
                 const imageId = workbook.addImage({
                     base64: pngImage.dataUrl,
                     extension: 'png',
                 });
                 // ExcelJS image positions are 0-based. currentRowIndex is 1-based.
                 // Row 8 in sheet = index 7 in image coords.
                 const zeroRow = currentRowIndex - 1;
                 worksheet.addImage(imageId, {
                     tl: { col: 3.15, row: zeroRow + 0.08 },
                     ext: imageSize,
                     editAs: 'oneCell'
                 });
              } catch(err) {
                 console.error('Failed to load image for', item.productos.nombre, err);
              }
          }
          currentRowIndex++;
      }

      // Bottom fields
      currentRowIndex++;
      worksheet.getCell(`A${currentRowIndex}`).value = '¿Quien recibe?______________________';
      worksheet.getCell(`A${currentRowIndex}`).font = { bold: true };
      worksheet.mergeCells(`A${currentRowIndex}:D${currentRowIndex}`);
      
      currentRowIndex++;
      worksheet.getCell(`A${currentRowIndex}`).value = 'Observaciones:';
      worksheet.getCell(`A${currentRowIndex}`).font = { bold: true };
      worksheet.mergeCells(`A${currentRowIndex}:D${currentRowIndex}`);

      worksheet.pageSetup.printArea = `A1:D${currentRowIndex}`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Requisicion_${role?.sucursal || 'General'}.xlsx`);

      setSelectionMode(false);
      setSelectedForRequisition([]);
    } catch (error) {
      console.error("Error generating excel:", error);
      alert("Error al generar el archivo Excel");
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (role?.role !== 'branch_admin' && role?.role !== 'super_admin') {
     return <div className="p-8 text-center text-red-500">Acceso Denegado. Se requiere ser Administrador de Sucursal.</div>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inventario / Stock</h1>
            <p className="text-sm text-gray-500">Administrando sucursal: <span className="font-semibold text-gray-900">{role?.sucursal}</span></p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {selectionMode ? (
              <>
                <Button 
                   variant="default" 
                   className="bg-green-600 hover:bg-green-700 text-white"
                   onClick={handleExportExcel} 
                   disabled={selectedForRequisition.length === 0 || isExportingExcel}
                >
                  {isExportingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  Exportar Requisición ({selectedForRequisition.length})
                </Button>
                <Button variant="outline" onClick={() => {
                  setSelectionMode(false);
                  setSelectedForRequisition([]);
                }}>
                  Cancelar Selección
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                className="text-green-700 border-green-600 hover:bg-green-50"
                onClick={() => setSelectionMode(true)} 
                disabled={isLoading || !stock || stock.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Modo Requisición
              </Button>
            )}
            
            <Button variant="outline" onClick={handleDownloadPDF} disabled={isLoading || !stock || stock.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Descargar Lista
            </Button>
            <Button onClick={handleCreate}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Producto
            </Button>
          </div>
       </div>

       <ProductDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen} 
          productToEdit={productToEdit} 
       />

       <Card>
          <CardHeader>
             <CardTitle>Productos en Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {isLoading ? (
               <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
               </div>
             ) : stock?.length === 0 ? (
               <div className="py-10 text-center text-gray-500">
                 No hay productos registrados.
               </div>
             ) : (
                <div className="divide-y divide-gray-100">
                   {stock?.map(item => (
                     <StockRow 
                       key={item.id} 
                       item={item} 
                       onEdit={handleEdit}
                       onSave={async (id, qty) => updateStock.mutateAsync({ id, product_id: item.product_id, quantity: qty })} 
                       selectionMode={selectionMode}
                       isSelected={selectedForRequisition.includes(item.product_id.toString())}
                       onToggleSelect={toggleSelection}
                     />
                   ))}
                </div>
             )}
          </CardContent>
       </Card>
    </div>
  );
}
