import ExcelJS from 'exceljs';

// --- Types ---

export type ParsedProductRow = {
  nombre: string;
  precio: number;
  empaque: string;
  descripcion: string;
  catalogo: string;
  categoria: string;
  subcategoria: string;
  tipo: string;
  imagen_url: string;
  _imageFile?: File | null;
  _rowIndex: number;
};

export type ImportParseResult = {
  products: ParsedProductRow[];
  errors: string[];
  warnings: string[];
};

// --- Column name normalization ---

const COLUMN_MAP: Record<string, keyof ParsedProductRow> = {
  'nombre': 'nombre',
  'nombre del producto': 'nombre',
  'producto': 'nombre',
  'name': 'nombre',
  'precio': 'precio',
  'precio base': 'precio',
  'price': 'precio',
  'empaque': 'empaque',
  'unidad': 'empaque',
  'unidad / empaque': 'empaque',
  'unit': 'empaque',
  'descripcion': 'descripcion',
  'descripción': 'descripcion',
  'description': 'descripcion',
  'catalogo': 'catalogo',
  'catálogo': 'catalogo',
  'catalog': 'catalogo',
  'categoria': 'categoria',
  'categoría': 'categoria',
  'category': 'categoria',
  'subcategoria': 'subcategoria',
  'subcategoría': 'subcategoria',
  'subcategory': 'subcategoria',
  'tipo': 'tipo',
  'type': 'tipo',
  'imagen': 'imagen_url',
  'imagen_url': 'imagen_url',
  'imagen url': 'imagen_url',
  'url imagen': 'imagen_url',
  'image': 'imagen_url',
  'image_url': 'imagen_url',
};

function normalizeColumnName(raw: string): keyof ParsedProductRow | null {
  const cleaned = raw.trim().toLowerCase().replace(/[_\-]/g, ' ');
  return COLUMN_MAP[cleaned] || null;
}

// --- SheetJS loader (from CDN) ---

let sheetJSLoaded: any = null;

async function loadSheetJS(): Promise<any> {
  if (sheetJSLoaded) return sheetJSLoaded;

  if ((window as any).XLSX) {
    sheetJSLoaded = (window as any).XLSX;
    return sheetJSLoaded;
  }

  return new Promise<any>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.type = 'text/javascript';

    script.onload = () => {
      const lib = (window as any).XLSX;
      if (lib) {
        sheetJSLoaded = lib;
        resolve(lib);
      } else {
        reject(new Error('SheetJS no se cargó correctamente'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar la librería de lectura Excel. Verifique su conexión a internet.'));
    document.head.appendChild(script);
  });
}

// --- Excel Parser using SheetJS (loaded from CDN) ---

export async function parseExcelFile(file: File): Promise<ImportParseResult> {
  const products: ParsedProductRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const XLSX = await loadSheetJS();
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      errors.push('El archivo Excel no contiene hojas de trabajo.');
      return { products, errors, warnings };
    }

    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to array of arrays (header: 1 returns raw rows)
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rows.length === 0) {
      errors.push('El archivo Excel está vacío.');
      return { products, errors, warnings };
    }

    // Read header row (first row)
    const headerCells: string[] = rows[0].map((cell: any) => String(cell ?? '').trim());
    const columnMapping: Map<number, keyof ParsedProductRow> = new Map();

    headerCells.forEach((rawHeader, colIndex) => {
      if (rawHeader) {
        const mapped = normalizeColumnName(rawHeader);
        if (mapped) {
          columnMapping.set(colIndex, mapped);
        } else {
          warnings.push(`Columna "${rawHeader}" (col ${colIndex + 1}) no fue reconocida y será ignorada.`);
        }
      }
    });

    if (!columnMapping.size) {
      errors.push('No se encontraron columnas válidas en la primera fila. Asegúrese de que la fila 1 contenga los encabezados.');
      return { products, errors, warnings };
    }

    // Check required column
    const hasNombre = Array.from(columnMapping.values()).includes('nombre');
    if (!hasNombre) {
      errors.push('Falta la columna obligatoria "Nombre". La primera fila debe tener al menos una columna llamada "Nombre" o "Producto".');
      return { products, errors, warnings };
    }

    // Parse data rows (starting from row index 1)
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row || row.every((cell: any) => !cell && cell !== 0)) continue; // Skip empty rows

      const product: Partial<ParsedProductRow> = {
        _rowIndex: rowIdx + 1, // 1-based for user display
      };

      columnMapping.forEach((field, colIdx) => {
        const cellValue = row[colIdx];
        const value = String(cellValue ?? '').trim();

        if (field === 'precio') {
          if (typeof cellValue === 'number') {
            (product as any)[field] = cellValue;
          } else {
            const parsed = parseFloat(value.replace(/[$,]/g, ''));
            (product as any)[field] = isNaN(parsed) ? 0 : parsed;
          }
        } else {
          (product as any)[field] = value;
        }
      });

      // Validate required fields
      if (!product.nombre) {
        warnings.push(`Fila ${rowIdx + 1}: Sin nombre de producto, se omitirá.`);
        continue;
      }

      // Build final row with defaults
      products.push({
        nombre: product.nombre || '',
        precio: product.precio || 0,
        empaque: product.empaque || 'Unidad',
        descripcion: product.descripcion || '',
        catalogo: product.catalogo || 'General',
        categoria: product.categoria || '',
        subcategoria: product.subcategoria || '',
        tipo: product.tipo || '-',
        imagen_url: product.imagen_url || '',
        _imageFile: null,
        _rowIndex: rowIdx + 1,
      });
    }

    if (products.length === 0) {
      warnings.push('No se encontraron productos válidos en el archivo.');
    }

    // --- Secondary pass: try to extract embedded images using ExcelJS ---
    if (products.length > 0) {
      try {
        const excelWorkbook = new ExcelJS.Workbook();
        const freshBuffer = await file.arrayBuffer();
        await excelWorkbook.xlsx.load(freshBuffer);

        const excelSheet = excelWorkbook.worksheets[0];
        if (excelSheet) {
          const images = excelSheet.getImages();

          for (const img of images) {
            const range = img.range as any;
            if (!range || !range.tl) continue;

            // ExcelJS: tl.row and tl.col are 0-based
            const imgRow = Math.floor(range.tl.nativeRow ?? range.tl.row); // 0-based
            const dataRowIdx = imgRow; // row 0 = header, row 1 = first data row (index 0 in SheetJS data)

            // Find the matching product (SheetJS rowIdx 1 = product[0], so excelJS row 1 = product[0])
            const matchingProduct = products.find(p => p._rowIndex === dataRowIdx + 1);
            if (!matchingProduct) continue;

            // Only assign if no URL was already provided and no file assigned
            if (matchingProduct._imageFile || (matchingProduct.imagen_url && matchingProduct.imagen_url.startsWith('http'))) continue;

            try {
              const imageId = img.imageId;
              const workbookImage = excelWorkbook.getImage(Number(imageId));
              if (workbookImage && workbookImage.buffer) {
                const ext = workbookImage.extension || 'png';
                const mimeType = ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                const blob = new Blob([workbookImage.buffer as ArrayBuffer], { type: mimeType });
                const imageFile = new File([blob], `import_${matchingProduct._rowIndex}.${ext}`, { type: mimeType });
                matchingProduct._imageFile = imageFile;
              }
            } catch {
              // Individual image extraction failed — skip
            }
          }
        }
      } catch {
        // ExcelJS image extraction failed (e.g., file has cell notes) — text data is preserved
        console.warn('No se pudieron extraer imágenes embebidas del Excel. Las imágenes pueden asignarse manualmente.');
      }
    }

  } catch (err: any) {
    errors.push(`Error al leer el archivo Excel: ${err.message || err}`);
  }

  return { products, errors, warnings };
}

// --- PDF Parser (dynamic load of pdf.js from CDN) ---

let pdfjsLoaded: any = null;

async function loadPdfJs() {
  if (pdfjsLoaded) return pdfjsLoaded;

  return new Promise<any>((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      pdfjsLoaded = (window as any).pdfjsLib;
      resolve(pdfjsLoaded);
      return;
    }

    const script = document.createElement('script');
    // Use the global UMD build so pdfjsLib is available on window
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.type = 'text/javascript';

    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfjsLoaded = lib;
        resolve(lib);
      } else {
        reject(new Error('pdf.js no se cargó correctamente'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar pdf.js. Verifique su conexión a internet.'));
    document.head.appendChild(script);
  });
}

export async function parsePdfFile(file: File): Promise<ImportParseResult> {
  const products: ParsedProductRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    const lines = fullText.split('\n').filter(l => l.trim());

    // Try to detect if there's a header line
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes('nombre') || lower.includes('producto') || lower.includes('precio')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      warnings.push('No se detectaron encabezados en el PDF. Se intentará extraer nombres de productos de cada línea.');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.length < 2) continue;

        const priceMatch = line.match(/\$?\s*(\d+(?:[.,]\d{2})?)/);
        let nombre = line;
        let precio = 0;

        if (priceMatch) {
          precio = parseFloat(priceMatch[1].replace(',', '.'));
          nombre = line.replace(priceMatch[0], '').trim();
        }

        if (nombre) {
          products.push({
            nombre,
            precio,
            empaque: 'Unidad',
            descripcion: '',
            catalogo: 'General',
            categoria: '',
            subcategoria: '',
            tipo: '-',
            imagen_url: '',
            _imageFile: null,
            _rowIndex: i + 1,
          });
        }
      }
    } else {
      const headerLine = lines[headerIdx];
      const headerParts = headerLine.split(/\s{2,}|\t/).map(h => h.trim()).filter(Boolean);
      const columnFields: (keyof ParsedProductRow | null)[] = headerParts.map(h => normalizeColumnName(h));

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
        const product: Partial<ParsedProductRow> = { _rowIndex: i + 1 };

        for (let j = 0; j < Math.min(parts.length, columnFields.length); j++) {
          const field = columnFields[j];
          if (!field) continue;

          if (field === 'precio') {
            const parsed = parseFloat(parts[j].replace(/[$,]/g, ''));
            (product as any)[field] = isNaN(parsed) ? 0 : parsed;
          } else {
            (product as any)[field] = parts[j];
          }
        }

        if (product.nombre) {
          products.push({
            nombre: product.nombre || '',
            precio: product.precio || 0,
            empaque: product.empaque || 'Unidad',
            descripcion: product.descripcion || '',
            catalogo: product.catalogo || 'General',
            categoria: product.categoria || '',
            subcategoria: product.subcategoria || '',
            tipo: product.tipo || '-',
            imagen_url: product.imagen_url || '',
            _imageFile: null,
            _rowIndex: i + 1,
          });
        }
      }
    }

    if (products.length === 0) {
      warnings.push('No se pudieron extraer productos del PDF. Para mejores resultados, use un archivo Excel.');
    }

  } catch (err: any) {
    errors.push(`Error al leer el PDF: ${err.message || err}`);
  }

  return { products, errors, warnings };
}

// --- Main dispatcher ---

export async function parseImportFile(file: File): Promise<ImportParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file);
  } else if (ext === 'pdf') {
    return parsePdfFile(file);
  } else {
    return {
      products: [],
      errors: [`Formato de archivo no soportado: .${ext}. Use archivos .xlsx o .pdf`],
      warnings: [],
    };
  }
}

// --- Excel Template Generator (uses ExcelJS for writing only) ---

export async function generateImportTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Plantilla Productos', {
    properties: { defaultRowHeight: 20 },
  });

  // Define columns
  worksheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 35 },
    { header: 'Precio', key: 'precio', width: 12 },
    { header: 'Empaque', key: 'empaque', width: 15 },
    { header: 'Descripción', key: 'descripcion', width: 30 },
    { header: 'Catálogo', key: 'catalogo', width: 15 },
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Subcategoría', key: 'subcategoria', width: 20 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Imagen URL', key: 'imagen_url', width: 40 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 30;

  // Add borders to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' },
    };
  });

  // Example rows
  const examples = [
    {
      nombre: 'Concha de Vainilla',
      precio: 15.00,
      empaque: 'Pieza',
      descripcion: 'Pan dulce clásico con cobertura de vainilla',
      catalogo: 'General',
      categoria: 'Panadería',
      subcategoria: 'Pan Dulce',
      tipo: 'Panadería mexicana',
      imagen_url: 'https://ejemplo.com/concha.jpg',
    },
    {
      nombre: 'Rosca de Reyes',
      precio: 180.00,
      empaque: 'Pieza',
      descripcion: 'Rosca tradicional para Día de Reyes',
      catalogo: 'Temporada',
      categoria: 'Panadería',
      subcategoria: 'Pan Dulce',
      tipo: 'Temporada',
      imagen_url: '',
    },
    {
      nombre: 'Café de Olla 1kg',
      precio: 85.00,
      empaque: 'Bolsa',
      descripcion: 'Café molido con canela y piloncillo',
      catalogo: 'General',
      categoria: 'Bebidas',
      subcategoria: 'Café',
      tipo: 'Bebidas calientes',
      imagen_url: '',
    },
  ];

  examples.forEach((ex) => {
    const row = worksheet.addRow(ex);
    row.font = { italic: true, color: { argb: 'FF999999' } };

    // Add light borders
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
    });
  });

  // Add instructions sheet
  const instructionsSheet = workbook.addWorksheet('Instrucciones');
  instructionsSheet.getColumn(1).width = 50;
  instructionsSheet.getColumn(2).width = 50;

  const instructions = [
    ['INSTRUCCIONES PARA IMPORTAR PRODUCTOS', ''],
    ['', ''],
    ['Columna', 'Descripción'],
    ['Nombre *', 'Nombre del producto (OBLIGATORIO)'],
    ['Precio', 'Precio base del producto (número, ej: 15.00)'],
    ['Empaque', 'Unidad de medida: Pieza, Caja, Kg, Bolsa, etc. (Default: Unidad)'],
    ['Descripción', 'Descripción adicional del producto'],
    ['Catálogo', 'Catálogo al que pertenece (Default: General)'],
    ['Categoría', 'Categoría del producto'],
    ['Subcategoría', 'Subcategoría del producto'],
    ['Tipo', 'Tipo de producto (ej: Panadería mexicana)'],
    ['Imagen URL', 'URL pública de la imagen del producto'],
    ['', ''],
    ['NOTAS IMPORTANTES:', ''],
    ['1. La primera fila DEBE contener los encabezados.', ''],
    ['2. Solo la columna "Nombre" es obligatoria.', ''],
    ['3. Los campos vacíos usarán valores predeterminados.', ''],
    ['4. Borre las filas de ejemplo antes de agregar sus datos.', ''],
    ['5. El archivo debe ser formato .xlsx', ''],
  ];

  instructions.forEach((row, i) => {
    const excelRow = instructionsSheet.addRow(row);
    if (i === 0) {
      excelRow.font = { bold: true, size: 14 };
    } else if (i === 2) {
      excelRow.font = { bold: true };
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
    } else if (i >= 13) {
      excelRow.font = { bold: i === 13, color: { argb: i === 13 ? 'FFDC2626' : 'FF666666' } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const { saveAs } = await import('file-saver');
  saveAs(blob, 'Plantilla_Importar_Productos_Kadmiel.xlsx');
}
