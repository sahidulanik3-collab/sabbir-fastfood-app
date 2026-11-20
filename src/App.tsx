import React, { useState } from 'react';
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

import { ActivationScreen } from './components/security/ActivationScreen';
import { isDeviceActivated } from './config/security';

export const App: React.FC = () => {
  const [isActivated, setIsActivated] = useState<boolean>(() => isDeviceActivated());

  // Prevent access to all pages until device is activated with predefined password
  if (!isActivated) {
    return <ActivationScreen onActivate={() => setIsActivated(true)} />;
  }

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
