import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';

import { HomeDashboard } from './pages/HomeDashboard';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomerLedgerPage } from './pages/CustomerLedgerPage';
import { PaymentHistoryPage } from './pages/PaymentHistoryPage';
import { OtherIncomePage } from './pages/OtherIncomePage';
import { ReportsPage } from './pages/ReportsPage';
import { DailyClosingPage } from './pages/DailyClosingPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<HomeDashboard />} />
              <Route path="sales" element={<SalesHistoryPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="customers" element={<CustomerLedgerPage />} />
              <Route path="payments" element={<PaymentHistoryPage />} />
              <Route path="income" element={<OtherIncomePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="closing" element={<DailyClosingPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </SettingsProvider>
  );
};

export default App;
