import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './NovoEvento.css'; 

export default function CadastroOrganizador() {
  const navigate = useNavigate();
  const { usuarioLogado } = useContext(AuthContext);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [documento, setDocumento] = useState('');

  if (usuarioLogado?.perfil !== 'ADMINISTRADOR') {
    return (
      <div className="acesso-restrito-container">
        <h2>Acesso Restrito</h2>
        <p>Você não tem permissão para visualizar esta página.</p>
        <button onClick={() => navigate('/')} className="btn-concluir">Voltar ao Início</button>
      </div>
    );
  }

  const handleCadastrar = async (e) => {
    e.preventDefault();
    const tokenSessao = localStorage.getItem('tokenSessao');

    try {
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/admin/organizadores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify({ nome, email, senha, documento })
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        alert("Ok " + dados.mensagem);
        setNome(''); setEmail(''); setSenha(''); setDocumento('');
      } else {
        alert("Erro!:" + dados.erro);
      }
    } catch (erro) {
      alert("Erro ao tentar cadastrar o organizador.");
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card">
        <h2>Cadastrar Novo Organizador</h2>
        <p className="admin-card-subtitle">
          Crie uma conta com permissões elevadas. Este usuário poderá criar e gerenciar eventos.
        </p>

        <form onSubmit={handleCadastrar} className="admin-form">
          <div className="form-group">
            <label>Nome Completo</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email Corporativo/Institucional</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Senha Provisória</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength="6" />
            </div>
          </div>

          <div className="form-group">
            <label>CPF ou RA (Opcional)</label>
            <input type="text" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Apenas números" />
          </div>

          <button type="submit" className="btn-admin-submit btn-cadastrar-organizador">
            Registrar Organizador
          </button>
        </form>
        
      </div>
    </section>
  );
}