

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthWrapper } from './features/auth/AuthWrapper';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './features/dashboard/Dashboard';

import { NewOrder } from './features/orders/NewOrder';
import { OrderList } from './features/orders/OrderList';
import { OrderDetail } from './features/orders/OrderDetail';
import { StockManager } from './features/stock/StockManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<AuthWrapper />}>
           <Route element={<AppShell />}>
             <Route path="/" element={<Dashboard />} />
             <Route path="/pos" element={<NewOrder />} />
             <Route path="/orders" element={<OrderList />} />
             <Route path="/orders/:id" element={<OrderDetail />} />
             <Route path="/stock" element={<StockManager />} />
           </Route>
        </Route>


        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

