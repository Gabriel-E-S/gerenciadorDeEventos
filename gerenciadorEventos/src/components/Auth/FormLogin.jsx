import React, { useState } from 'react';

export default function FormLogin({ onSubmit, isCarregando }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ email, senha });
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="seu@email.com" 
          required 
          disabled={isCarregando}
        />
      </div>
      <div className="form-group">
        <label>Senha</label>
        <input 
          type="password" 
          value={senha} 
          onChange={(e) => setSenha(e.target.value)} 
          placeholder="sua senha" 
          required 
          disabled={isCarregando}
        />
      </div>
      <button type="submit" className="btn-auth-submit" disabled={isCarregando}>
        {isCarregando ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}