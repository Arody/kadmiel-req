import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Loader2, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, X, Download, Trash2, ImagePlus } from 'lucide-react';
import { parseImportFile, generateImportTemplate, type ImportParseResult } from '../../utils/fileImportUtils';
import { useBulkImportProducts, type BulkImportProgress, type BulkImportResult } from '../../hooks/useBulkImportProducts';

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

type ImportProductsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportProductsDialog({ open, onOpenChange }: ImportProductsDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState<BulkImportProgress | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [removedRows, setRemovedRows] = useState<Set<number>>(new Set());
  const [manualImages, setManualImages] = useState<Map<number, File>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageAssignTarget, setImageAssignTarget] = useState<number | null>(null);

  const { mutateAsync: importProducts } = useBulkImportProducts();

  const resetState = useCallback(() => {
    setStep('upload');
    setSelectedFile(null);
    setParseResult(null);
    setIsParsing(false);
    setProgress(null);
    setImportResult(null);
    setDragActive(false);
    setRemovedRows(new Set());
    setManualImages(new Map());
    setImageAssignTarget(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step !== 'importing') {
      resetState();
      onOpenChange(false);
    }
  }, [step, resetState, onOpenChange]);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setRemovedRows(new Set());

    try {
      const result = await parseImportFile(file);
      setParseResult(result);
      if (result.errors.length === 0 && result.products.length > 0) {
        setStep('preview');
      } else if (result.errors.length > 0) {
        // Stay on upload step but show errors
      } else {
        setStep('preview');
      }
    } catch (err: any) {
      setParseResult({
        products: [],
        errors: [`Error inesperado: ${err.message}`],
        warnings: [],
      });
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'pdf') {
        handleFileSelect(file);
      }
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleRemoveRow = useCallback((rowIndex: number) => {
    setRemovedRows(prev => {
      const next = new Set(prev);
      next.add(rowIndex);
      return next;
    });
  }, []);

  const handleAssignImage = useCallback((rowIndex: number) => {
    setImageAssignTarget(rowIndex);
    imageInputRef.current?.click();
  }, []);

  const handleImageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && imageAssignTarget !== null) {
      // Update the product's _imageFile directly
      if (parseResult) {
        const product = parseResult.products.find(p => p._rowIndex === imageAssignTarget);
        if (product) {
          product._imageFile = file;
        }
      }
      setManualImages(prev => {
        const next = new Map(prev);
        next.set(imageAssignTarget, file);
        return next;
      });
    }
    setImageAssignTarget(null);
    // Reset the input so the same file can be selected again
    if (e.target) e.target.value = '';
  }, [imageAssignTarget, parseResult]);

  const activeProducts = parseResult?.products.filter(p => !removedRows.has(p._rowIndex)) || [];

  const handleImport = useCallback(async () => {
    if (!activeProducts.length) return;

    setStep('importing');
    setProgress({ current: 0, total: activeProducts.length, currentProduct: '' });

    try {
      const result = await importProducts({
        products: activeProducts,
        onProgress: setProgress,
      });
      setImportResult(result);
      setStep('done');
    } catch (err: any) {
      setImportResult({
        total: activeProducts.length,
        success: 0,
        failed: activeProducts.length,
        errors: [`Error general: ${err.message}`],
      });
      setStep('done');
    }
  }, [activeProducts, importProducts]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await generateImportTemplate();
    } catch (err) {
      console.error('Error generating template:', err);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl bg-white overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Importar Productos desde Archivo
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Drag & Drop Area */}
            <div
              className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
                ${dragActive
                  ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.pdf"
                className="hidden"
                onChange={handleInputChange}
              />

              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-600">Analizando archivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-3">
                    <div className="bg-green-100 rounded-lg p-3">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="bg-red-100 rounded-lg p-3">
                      <FileText className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-medium text-gray-700">
                      Arrastra un archivo aquí o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Formatos soportados: Excel (.xlsx) o PDF (.pdf)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Errors from parsing */}
            {parseResult?.errors && parseResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Errores encontrados
                </div>
                <ul className="text-sm text-red-600 space-y-1">
                  {parseResult.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {parseResult?.warnings && parseResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-700 font-medium mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Advertencias
                </div>
                <ul className="text-sm text-yellow-600 space-y-1">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Download Template Button */}
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-gray-500">
                ¿No tienes un archivo? Descarga la plantilla Excel de ejemplo.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} type="button">
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && parseResult && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">{selectedFile?.name}</span>
              </div>
              <span className="text-sm text-blue-700 font-semibold">
                {activeProducts.length} producto{activeProducts.length !== 1 ? 's' : ''} a importar
              </span>
            </div>

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <ul className="text-xs text-yellow-700 space-y-0.5">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i}>⚠️ {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Product Table Preview */}
            {/* Hidden input for manual image assignment */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageInputChange}
            />

            <div className="border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-600">#</th>
                    <th className="text-left p-2 font-medium text-gray-600">Nombre</th>
                    <th className="text-left p-2 font-medium text-gray-600">Precio</th>
                    <th className="text-left p-2 font-medium text-gray-600">Empaque</th>
                    <th className="text-left p-2 font-medium text-gray-600">Categoría</th>
                    <th className="text-left p-2 font-medium text-gray-600">Imagen</th>
                    <th className="text-center p-2 font-medium text-gray-600 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.products.map((product, idx) => {
                    const isRemoved = removedRows.has(product._rowIndex);
                    if (isRemoved) return null;

                    return (
                      <tr key={idx} className="border-t hover:bg-gray-50 transition-colors">
                        <td className="p-2 text-gray-400">{idx + 1}</td>
                        <td className="p-2 font-medium text-gray-900">{product.nombre}</td>
                        <td className="p-2 text-gray-700">
                          ${Number(product.precio || 0).toFixed(2)}
                        </td>
                        <td className="p-2 text-gray-600">{product.empaque}</td>
                        <td className="p-2 text-gray-600">
                          {product.categoria ? `${product.categoria}` : '-'}
                          {product.subcategoria && (
                            <span className="text-gray-400"> / {product.subcategoria}</span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            {(product._imageFile || manualImages.get(product._rowIndex)) ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" /> {(product._imageFile || manualImages.get(product._rowIndex))?.name?.substring(0, 10) || 'Imagen'}...
                              </span>
                            ) : product.imagen_url && product.imagen_url.startsWith('http') ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                URL
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded-full transition-colors cursor-pointer"
                                onClick={() => handleAssignImage(product._rowIndex)}
                                title="Asignar imagen"
                              >
                                <ImagePlus className="h-3 w-3" /> Agregar
                              </button>
                            )}
                            {(product._imageFile || manualImages.get(product._rowIndex) || (product.imagen_url && product.imagen_url.startsWith('http'))) && (
                              <button
                                type="button"
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                onClick={() => handleAssignImage(product._rowIndex)}
                                title="Cambiar imagen"
                              >
                                <ImagePlus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            onClick={() => handleRemoveRow(product._rowIndex)}
                            title="Quitar de la importación"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { resetState(); }} type="button">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={activeProducts.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
                type="button"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar {activeProducts.length} Producto{activeProducts.length !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && progress && (
          <div className="space-y-6 py-6">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Importando productos...</h3>
              <p className="text-sm text-gray-500 mt-1">
                No cierres esta ventana mientras se importan los productos.
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Progreso</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 truncate">
                Procesando: {progress.currentProduct}
              </p>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResult && (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className={`rounded-xl p-6 text-center ${
              importResult.failed === 0 ? 'bg-green-50' : importResult.success === 0 ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              {importResult.failed === 0 ? (
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              ) : (
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
              )}
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Importación {importResult.failed === 0 ? 'Completada' : 'Completada con errores'}
              </h3>

              <div className="flex justify-center gap-6 mt-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
                  <p className="text-xs text-gray-500">Exitosos</p>
                </div>
                {importResult.failed > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                    <p className="text-xs text-gray-500">Fallidos</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-700">{importResult.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>

            {/* Errors list */}
            {importResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-red-700 mb-2">Errores:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose} type="button">
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
