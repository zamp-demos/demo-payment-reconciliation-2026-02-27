import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProcessList from './components/ProcessList';
import ProcessDetails from './components/ProcessDetails';
import KnowledgeBase from './components/KnowledgeBase';
import PeoplePage from './components/People';
import Login from './components/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/done" element={<DashboardLayout />}>
          <Route index element={<Navigate to="payment-reconciliation" replace />} />
          <Route path="payment-reconciliation" element={
            <ProcessList key="payment-reconciliation" title="Payment Reconciliation" category="Payment Reconciliation" />
          } />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="process/:id" element={<ProcessDetails />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
