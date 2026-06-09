
import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  
  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    const dadosSalvos = localStorage.getItem('dadosUsuario');
    return dadosSalvos ? JSON.parse(dadosSalvos) : null;
  });

  const login = (dadosUsuario, token) => {
    localStorage.setItem('tokenSessao', token);
    localStorage.setItem('dadosUsuario', JSON.stringify(dadosUsuario));
    setUsuarioLogado(dadosUsuario); 
  };

  const logout = () => {
    localStorage.removeItem('tokenSessao');
    localStorage.removeItem('dadosUsuario');
    setUsuarioLogado(null); 
  };

  return (
    <AuthContext.Provider value={{ usuarioLogado, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}