import React, { useState } from 'react';

export default function FormCadastro({ onSubmit, isCarregando }) {
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ nome, documento, email, senha });
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Nome Completo</label>
        <input 
          type="text" 
          value={nome} 
          onChange={(e) => setNome(e.target.value)} 
          placeholder="Digite seu nome" 
          required 
          disabled={isCarregando}
        />
      </div>
      <div className="form-group">
        <label>Documento (RA ou CPF)</label>
        <input 
          type="text" 
          value={documento} 
          onChange={(e) => setDocumento(e.target.value)} 
          placeholder="Identificação única" 
          required 
          disabled={isCarregando}
        />
      </div>
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
        {isCarregando ? 'Cadastrando...' : 'Cadastrar'}
      </button>
    </form>
  );
}