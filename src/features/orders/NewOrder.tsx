import { useState } from 'react';
import { useProducts, type Product } from '../../hooks/useProducts';
import { useCreateOrder } from '../../hooks/useCreateOrder';
import { useProfile } from '../../hooks/useProfile';
import { useUserRole } from '../../hooks/useUserRole';
// import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Plus, Minus, ShoppingCart, Loader2, Save, Trash2, LayoutGrid, List as ListIcon, ChevronDown, ChevronUp } from 'lucide-react';

export function NewOrder() {
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { mutateAsync: createOrder, isPending: isSubmitting } = useCreateOrder();
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isClientInfoOpen, setIsClientInfoOpen] = useState(true);
  
  /* Custom Order Fields */
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [notes, setNotes] = useState('');

  const filteredProducts = products?.filter(p => 
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.precio * item.quantity), 0);

  const handleSubmit = async () => {
    if (!customerName) {
      alert('Por favor ingrese el nombre del cliente');
      return;
    }
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    if (!profile?.id) return;

    try {
      await createOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_date: deliveryDate ? deliveryDate : undefined,
        delivery_time: deliveryTime ? deliveryTime : undefined,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        payment_method: paymentMethod,
        total: totalAmount,
        sucursal: userRole?.sucursal || 'Sin Sucursal',
        created_by: profile.id,
        items: cart,
        notes: notes
      });
      
      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryDate('');
      setDeliveryTime('');
      setDeliveryAddress('');
      setNotes('');
      alert('Orden creada exitosamente');
    } catch (error) {
      console.error(error);
      alert('Error al crear la orden');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4">
      {/* Main Section */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        
        {/* Compact Customer Info */}
        <div className="bg-white border rounded-lg shadow-sm">
            <div 
                className="flex items-center justify-between p-3 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setIsClientInfoOpen(!isClientInfoOpen)}
            >
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm text-gray-900">Datos del Cliente y Entrega</h2>
                    <span className="text-xs text-gray-500">
                        {customerName ? `• ${customerName}` : ''} 
                        {deliveryType === 'delivery' ? ' • A Domicilio' : ' • En Sucursal'}
                    </span>
                </div>
                {isClientInfoOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            </div>
            
            {isClientInfoOpen && (
                <div className="p-3 border-t grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Cliente *</label>
                        <Input className="h-8 text-sm" placeholder="Nombre completo" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                         <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                         <Input className="h-8 text-sm" placeholder="ej. 961..." value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo Entrega</label>
                        <select 
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={deliveryType}
                            onChange={(e) => setDeliveryType(e.target.value as any)}
                        >
                            <option value="pickup">En Sucursal</option>
                            <option value="delivery">A Domicilio</option>
                        </select>
                    </div>

                    {deliveryType === 'delivery' && (
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                            <Input className="h-8 text-sm" placeholder="Calle, Número, Colonia" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Entrega</label>
                        <Input type="date" className="h-8 text-sm" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
                        <Input type="time" className="h-8 text-sm" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
                    </div>

                    <div className="col-span-1 md:col-span-4 pt-1 flex items-center gap-2 overflow-x-auto">
                        <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Pago:</span>
                        {['Efectivo', 'Transferencia', 'Débito', 'Crédito'].map(method => (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={`px-2 py-1 text-xs font-medium rounded border whitespace-nowrap transition-colors ${
                                    paymentMethod === method 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {method}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Product Search & List */}
        <div className="bg-white rounded-lg border shadow-sm flex flex-col flex-1 overflow-hidden">
             <div className="p-3 border-b bg-gray-50 flex items-center gap-3">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                 <Input 
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="pl-9 bg-white h-9"
                   placeholder="Buscar productos..." 
                 />
               </div>
               <div className="flex bg-gray-200 rounded-md p-0.5">
                   <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Vista Tarjetas"
                   >
                       <LayoutGrid className="h-4 w-4" />
                   </button>
                   <button 
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-sm transition-all ${viewMode === 'list' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Vista Lista"
                   >
                       <ListIcon className="h-4 w-4" />
                   </button>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
               {loadingProducts ? (
                 <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
               ) : (
                 <div className={viewMode === 'grid' 
                    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" 
                    : "flex flex-col gap-2"
                 }>
                    {filteredProducts?.map(product => (
                      viewMode === 'grid' ? (
                        // GRID CARD
                        <div 
                            key={product.id} 
                            className="group relative flex flex-col border rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer bg-white"
                            onClick={() => addToCart(product)}
                        >
                             <div className="aspect-square bg-gray-100 flex items-center justify-center relative overflow-hidden">
                                {product.imagen_url ? (
                                   <img src={product.imagen_url} alt={product.nombre} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                   <span className="text-4xl opacity-50">🥯</span>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                   <div className="bg-white/90 rounded-full p-2 shadow-sm">
                                      <Plus className="h-5 w-5 text-primary" />
                                   </div>
                                </div>
                             </div>
                             <div className="p-3 flex flex-col flex-1">
                                <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 leading-tight">{product.nombre}</h3>
                                <div className="mt-auto pt-2 flex items-center justify-between">
                                   <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{product.empaque}</span>
                                   <span className="font-bold text-sm text-primary">${product.precio}</span>
                                </div>
                             </div>
                        </div>
                      ) : (
                        // LIST ROW
                        <div 
                            key={product.id}
                            className="group flex items-center gap-3 p-2 bg-white border rounded-md hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                            onClick={() => addToCart(product)}
                        >
                            <div className="h-10 w-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                                {product.imagen_url ? (
                                   <img src={product.imagen_url} className="w-full h-full object-cover" />
                                ) : (
                                   <div className="w-full h-full flex items-center justify-center text-lg">🥯</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm text-gray-900 truncate">{product.nombre}</h4>
                                <p className="text-xs text-gray-500">{product.empaque}</p>
                            </div>
                            <div className="text-right px-2">
                                <span className="font-bold text-sm text-primary block">${product.precio}</span>
                            </div>
                            <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                      )
                    ))}
                 </div>
               )}
             </div>
        </div>
      </div>

      {/* Sidebar Cart - Cleaned up */}
      <div className="w-80 flex flex-col bg-white border-l shadow-xl z-20">
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2 uppercase tracking-wide text-gray-600">
            <ShoppingCart className="h-4 w-4" />
            Orden
          </h2>
          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
             {cart.reduce((acc, i) => acc + i.quantity, 0)} items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-2">
              <ShoppingCart className="h-12 w-12 opacity-20" />
              <p className="text-sm">Tu carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex gap-3 group relative bg-white p-2 rounded-lg border border-transparent hover:border-gray-100 hover:shadow-sm transition-all">
                 <div className="h-12 w-12 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                    {item.product.imagen_url ? (
                        <img src={item.product.imagen_url} className="w-full h-full object-cover" />
                    ) : ( 
                        <div className="w-full h-full flex items-center justify-center">🥯</div>
                    )}
                 </div>
                 <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                         <h4 className="font-medium text-xs text-gray-900 line-clamp-2">{item.product.nombre}</h4>
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                removeFromCart(item.product.id);
                            }} 
                            className="text-gray-300 hover:text-red-500 transition-colors -mt-1 -mr-1 p-1"
                         >
                            <Trash2 className="h-3 w-3" />
                         </button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                       <p className="text-xs text-gray-500 font-medium">${item.product.precio * item.quantity}</p>
                       <div className="flex items-center bg-gray-100 rounded-md">
                           <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-200 rounded-l-md text-gray-600">
                              <Minus className="h-3 w-3" />
                           </button>
                           <span className="text-xs w-6 text-center font-medium bg-white h-5 flex items-center justify-center shadow-sm">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-200 rounded-r-md text-gray-600">
                              <Plus className="h-3 w-3" />
                           </button>
                       </div>
                    </div>
                 </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-gray-50/50 space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-600 mb-1 block">Notas</span>
            <textarea 
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 min-h-[80px]"
                placeholder="Instrucciones especiales, dedicatoria, etc..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-end">
             <span className="text-sm text-gray-500 mb-1">Total a Pagar</span>
             <span className="text-2xl font-bold text-gray-900 tracking-tight">${totalAmount.toFixed(2)}</span>
          </div>

          <Button className="w-full font-semibold shadow-sm" size="lg" onClick={handleSubmit} disabled={isSubmitting || cart.length === 0}>
             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
             Confirmar Orden
          </Button>
        </div>
      </div>
    </div>
  );
}
