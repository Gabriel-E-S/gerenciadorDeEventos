import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Home from './pages/Public/Home'; 
import Eventos from './pages/Public/Eventos';
import Sobre from './pages/Public/Sobre';
import Contato from './pages/Public/Contato';
import Dashboard from './pages/Participante/Dashboard';
import Scanner from './pages/Admin/Scanner';
import Auth from './pages/Public/Auth';
import NovoEvento from './pages/Admin/NovoEvento';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './context/ProtectedRoute';
import EditarEvento from './pages/Admin/EditarEvento';
import DetalhesEvento from './pages/Public/DetalhesEvento';
import CadastroOrganizador from './pages/Admin/CadastroOrganizador';

export default function App() {
  return (
    
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/sobre" element={<Sobre />} />
            <Route path="/contato" element={<Contato />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/eventos/:id" element={<DetalhesEvento />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/scanner" element={
              <ProtectedRoute perfisPermitidos={['ORGANIZADOR', 'ADMINISTRADOR']}>
                <Scanner />
              </ProtectedRoute>
            } />
            
            <Route path="/admin/novo-evento" element={
              <ProtectedRoute perfisPermitidos={['ORGANIZADOR', 'ADMINISTRADOR']}>
                <NovoEvento />
              </ProtectedRoute>
            } />
            <Route path="/admin/editar-evento/:id" element={
              <ProtectedRoute perfisPermitidos={['ORGANIZADOR', 'ADMINISTRADOR']}>
                <EditarEvento />
              </ProtectedRoute>
            } />
            <Route path="/admin/organizadores" element={
              <ProtectedRoute perfisPermitidos={['ADMINISTRADOR']}>
                <CadastroOrganizador />
              </ProtectedRoute>
            } />

        </Routes>
      </main>
      </BrowserRouter>
    </AuthProvider>
  );
}