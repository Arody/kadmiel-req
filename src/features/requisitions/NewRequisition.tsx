
import { useState } from 'react';
import { useProducts, type Product } from '../../hooks/useProducts';
import { useCreateRequisition } from '../../hooks/useCreateRequisition';
import { useProfile } from '../../hooks/useProfile';
import { useUserRole } from '../../hooks/useUserRole';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type CartItem = Product & {
  quantity: number;
};

export function NewRequisition() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const { data: products, isLoading: productsLoading } = useProducts(search);
  const { mutate: createRequisition, isPending: isSubmitting } = useCreateRequisition();
  const { data: profile } = useProfile();
  const { data: role } = useUserRole();
  const navigate = useNavigate();

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(p => p.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.id === productId) {
        const newQty = Math.max(1, p.quantity + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const handleSubmit = () => {
    if (!cart.length || !profile || !role) return;

    createRequisition({
      sucursal: role.sucursal || 'Sin Sucursal', // Fallback or validation
      solicitante: profile.full_name,
      puesto: role.role, // Or define a separate 'puesto' field if user has it
      userId: profile.id,
      items: cart.map(item => ({
        productId: item.id,
        productName: item.nombre,
        quantity: item.quantity
      }))
    }, {
      onSuccess: () => {
        // Show success toast?
        alert('Requisición creada con éxito');
        setCart([]);
        navigate('/');
      },
      onError: (err) => {
        alert('Error al crear requisición: ' + err.message);
      }
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-theme(spacing.24))] gap-6">
      {/* Product Search & List */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            className="pl-10"
            placeholder="Buscar productos..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
          {productsLoading ? (
             <div className="col-span-full text-center py-10">
               <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
             </div>
          ) : (
            products?.map(product => (
              <Card key={product.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                   <div className="aspect-square bg-gray-100 rounded-md mb-4 flex items-center justify-center">
                     {product.imagen_url ? (
                       <img src={product.imagen_url} alt={product.nombre} className="object-cover h-full w-full rounded-md" />
                     ) : (
                       <Package className="h-10 w-10 text-gray-300" />
                     )}
                   </div>
                   <h3 className="font-medium text-gray-900 line-clamp-2">{product.nombre}</h3>
                   <p className="text-sm text-gray-500 mt-1">{product.empaque}</p>
                </CardContent>
                <div className="p-4 pt-0">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => addToCart(product)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <Card className="w-full lg:w-96 flex flex-col h-full border-l lg:border-l-gray-200 lg:border-y-0 lg:border-r-0 lg:shadow-none lg:rounded-none lg:bg-gray-50/50">
        <CardHeader>
           <CardTitle className="flex items-center">
             <ShoppingCart className="mr-2 h-5 w-5" />
             Carrito ({cart.length})
           </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
           {cart.length === 0 ? (
             <div className="text-center text-gray-500 py-10">
               No hay items en la requisición.
             </div>
           ) : (
             cart.map(item => (
               <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-500">{item.empaque}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
               </div>
             ))
           )}
        </CardContent>
        <div className="p-6 border-t bg-white">
           <Button className="w-full" size="lg" disabled={cart.length === 0 || isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Crear Requisición
                </>
              )}
           </Button>
        </div>
      </Card>
    </div>
  );
}

function Package(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22v-10" />
    </svg>
  )
}
