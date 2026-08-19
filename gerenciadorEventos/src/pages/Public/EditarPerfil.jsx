import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api'; 
import Loader from '../../components/UI/Loader';
import './EditarPerfil.css';

export default function EditarPerfil() {
  const navigate = useNavigate();
  const { usuarioLogado } = useContext(AuthContext);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  
  const [perfilData, setPerfilData] = useState({
    nome: '',
    email: '',
    senhaAntiga: '', 
    senhaNova: '',
    fotoUrl: ''
  });
  const [novaFotoArquivo, setNovaFotoArquivo] = useState(null);


  useEffect(() => {
    const buscarPerfil = async () => {
      try {
        const resposta = await api.get('/api/usuario/perfil');
        const dados = resposta.data;
        
        setPerfilData({
          nome: dados.nome,
          email: dados.email,
          senhaAntiga: '',
          senhaNova: '', 
          fotoUrl: dados.fotoUrl
        });
        
      } catch (erro) {
        console.error("Erro ao carregar perfil:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarPerfil();
  }, []); 

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPerfilData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNovaFotoArquivo(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (perfilData.senhaNova && !perfilData.senhaAntiga) {
        alert("Proteção de Segurança: Você precisa digitar sua Senha Atual para poder cadastrar uma Nova Senha.");
        return;
    }

    setSalvando(true);

    const formData = new FormData();
    formData.append('nome', perfilData.nome);
    formData.append('email', perfilData.email);
    
    if (perfilData.senhaNova) {
      formData.append('senhaNova', perfilData.senhaNova);
      formData.append('senhaAntiga', perfilData.senhaAntiga);
    }
    
    if (novaFotoArquivo) {
      formData.append('fotoPerfil', novaFotoArquivo);
    }

    try {
      const resposta = await api.put('/api/usuario/perfil', formData);
      const dados = resposta.data;

      alert("Ok " + dados.mensagem);
        
      setPerfilData(prev => ({ 
          ...prev, 
          fotoUrl: dados.fotoUrl || prev.fotoUrl, 
          senhaAntiga: '', 
          senhaNova: '' 
      }));
      
      if (dados.fotoUrl) {
          setFotoPreview(null);
          setNovaFotoArquivo(null);
      }
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro de conexão ao atualizar perfil.";
      alert("Erro: " + msgErro);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Loader mensagem="Carregando suas informações..." />;

  const imagemExibida = fotoPreview || perfilData.fotoUrl || "https://res.cloudinary.com/demo/image/upload/d_avatar.png/non_existing_id.png";

  return (
    <section className="perfil-container">
      <div className="perfil-card">
        <h2>Meu Perfil</h2>
        <p className="perfil-subtitulo">Gerencie suas informações pessoais e credenciais de acesso.</p>

        <form onSubmit={handleSubmit} className="perfil-form">
          
          <div className="perfil-foto-section">
            <div className="perfil-foto-wrapper">
              <img src={imagemExibida} alt="Sua foto de perfil" className="perfil-foto-avatar" />
            </div>
            <div className="perfil-foto-inputs">
              <label className="btn-alterar-foto">
                Escolher Nova Foto
                <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} hidden />
              </label>
              <small>Formatos aceitos: JPG, PNG. Tamanho ideal: 400x400px.</small>
            </div>
          </div>

          <div className="form-group">
            <label>Nome Completo</label>
            <input 
              type="text" 
              name="nome" 
              value={perfilData.nome} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label>E-mail de Acesso</label>
            <input 
              type="email" 
              name="email" 
              value={perfilData.email} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="perfil-divisor">
            <span>Segurança da Conta</span>
          </div>

          <div className="form-group">
            <label>Senha Atual</label>
            <input 
              type="password" 
              name="senhaAntiga" 
              value={perfilData.senhaAntiga} 
              onChange={handleChange} 
              placeholder="Obrigatória apenas se for alterar a senha" 
              required={perfilData.senhaNova.length > 0} 
            />
          </div>

          <div className="form-group">
            <label>Nova Senha</label>
            <input 
              type="password" 
              name="senhaNova" 
              value={perfilData.senhaNova} 
              onChange={handleChange} 
              placeholder="Preencha apenas se quiser alterar" 
            />
          </div>

          <div className="perfil-actions">
            <button type="button" className="btn-cancelar" onClick={() => navigate(-1)}>
              Voltar
            </button>
            <button type="submit" className="btn-salvar" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}