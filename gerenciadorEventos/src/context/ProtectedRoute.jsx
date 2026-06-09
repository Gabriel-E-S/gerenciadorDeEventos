import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export default function ProtectedRoute({ children, perfisPermitidos }) {
  const { usuarioLogado } = useContext(AuthContext);

  if (!usuarioLogado) {
    return <Navigate to="/login" replace />;
  }

  if (perfisPermitidos && !perfisPermitidos.includes(usuarioLogado.perfil)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}