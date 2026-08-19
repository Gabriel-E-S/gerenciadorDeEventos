import React, { useState, useEffect } from 'react';
import api from '../../services/api'; 
import './NovoEvento.css';

export default function CadastroOrganizador() {
  
  const [formData, setFormData] = useState({ nome: '', email: '', senha: '', documento: '' });
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarUsuarios = async () => {
    setCarregando(true);
    try {
    
      const resposta = await api.get('/api/admin/usuarios');
      setListaUsuarios(resposta.data); 
    } catch (erro) {
      console.error("Erro ao carregar usuários", erro);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      
      const resposta = await api.post('/api/admin/usuarios', formData);
      
      alert(resposta.data.mensagem);
      setFormData({ nome: '', email: '', senha: '', documento: '' });
      carregarUsuarios(); 
      
    } catch (erro) {
      const mensagemErro = erro.response?.data?.erro || "Erro ao cadastrar organizador.";
      alert("Erro: " + mensagemErro);
    }
  };

  const handleAlterarPerfil = async (id_usuario, novoPerfil) => {
    if (!window.confirm(`Tem certeza que deseja mudar este usuário para ${novoPerfil}?`)) return;
    
    try {
      const resposta = await api.put(`/api/admin/usuarios/${id_usuario}/perfil`, { novoPerfil });
      
      alert(resposta.data.mensagem);
      carregarUsuarios(); 
      
    } catch (erro) {
      const mensagemErro = erro.response?.data?.erro || "Erro ao tentar atualizar o perfil.";
      alert("Erro: " + mensagemErro);
      carregarUsuarios();
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card" style={{ maxWidth: '900px' }}>
        <h2>Painel de Gerenciamento de Usuários</h2>
        <p className="admin-card-subtitle">Cadastre novos membros da equipe ou altere permissões de usuários existentes.</p>

        <div className="cadastro-novo-box">
          <h3>Cadastrar Novo Organizador</h3>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-row">
              <div className="form-group">
                <label>Nome Completo</label>
                <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Nome do organizador" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@uepg.br" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Senha de Acesso</label>
                <input type="password" required value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} placeholder="Crie uma senha temporária" />
              </div>
              <div className="form-group">
                <label>Documento (CPF ou RA) - Opcional</label>
                <input type="text" value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})} placeholder="Somente números" />
              </div>
            </div>
            <button type="submit" className="btn-admin-submit btn-cadastrar-organizador">Criar Conta de Organizador</button>
          </form>
        </div>

        <div className="lista-usuarios-box" style={{ marginTop: '3rem', borderTop: '2px dashed var(--border-color)', paddingTop: '2rem' }}>
          <h3>Usuários do Sistema</h3>
          
          {carregando ? (
            <p>Carregando lista de usuários...</p>
          ) : (
            <div className="tabela-responsiva">
              <table className="tabela-usuarios">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Documento</th>
                    <th>Cargo Atual</th>
                  </tr>
                </thead>
                <tbody>
                  {listaUsuarios.map(usuario => (
                    <tr key={usuario.id_usuario}>
                      <td>{usuario.nome}</td>
                      <td>{usuario.email}</td>
                      <td>{usuario.ra || usuario.cpf || '-'}</td>
                      <td>
                        <select 
                          className={`select-perfil ${usuario.tipoPerfil.toLowerCase()}`}
                          value={usuario.tipoPerfil}
                          onChange={(e) => handleAlterarPerfil(usuario.id_usuario, e.target.value)}
                        >
                          <option value="PARTICIPANTE">Participante</option>
                          <option value="ORGANIZADOR">Organizador</option>
                          <option value="ADMINISTRADOR">Administrador</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}