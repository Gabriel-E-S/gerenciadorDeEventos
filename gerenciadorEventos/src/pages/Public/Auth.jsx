import React, { useState, useEffect, useContext } from 'react'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google'; 
import api from '../../services/api'; 
import FormLogin from '../../components/Auth/FormLogin';
import FormCadastro from '../../components/Auth/FormCadastro';
import './Auth.css';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate(); 
  const { login } = useContext(AuthContext);
  
  const [isLogin, setIsLogin] = useState(location.state?.modoLogin ?? true);
  const [mensagemErro, setMensagemErro] = useState('');
  const [isCarregando, setIsCarregando] = useState(false);
  const [dadosIniciaisCadastro, setDadosIniciaisCadastro] = useState(null);

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsCarregando(true);
    setMensagemErro('');
    
    const tokenGoogleOriginal = credentialResponse.credential;

    try {
      const resposta = await api.post('/api/auth/google', { 
        token_google: tokenGoogleOriginal 
      });
      
      const dados = resposta.data;

      if (dados.acao === 'login') {
        login(dados.usuario, dados.token, dados.refreshToken);
        
        if (dados.usuario.perfil === 'ORGANIZADOR') navigate('/scanner');
        else if (dados.usuario.perfil === 'ADMINISTRADOR') navigate('/eventos');
        else navigate('/dashboard');
        
      } else if (dados.acao === 'completar_cadastro') {
        setDadosIniciaisCadastro({
            ...dados.dados_sugeridos,
            token_google: tokenGoogleOriginal
        });
        setIsLogin(false);
        alert("Quase lá! Preencha os dados restantes e escolha sua foto para finalizar o cadastro.");
      }
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || erro.message || 'Erro na integração com Google';
      setMensagemErro(msgErro);
    } finally {
      setIsCarregando(false);
    }
  };

  useEffect(() => {
    if (location.state !== null && location.state.modoLogin !== undefined) {
      setIsLogin(location.state.modoLogin);
      setMensagemErro(''); 
    }
  }, [location.state]);

  const handleLoginSubmit = async (dadosLogin) => {
    setMensagemErro('');
    setIsCarregando(true);
    try {
      const resposta = await api.post('/api/login', dadosLogin);
      const dados = resposta.data;

      login(dados.usuario, dados.token, dados.refreshToken); 
      
      alert('Login realizado com sucesso!');
      
      if (dados.usuario.perfil === 'ORGANIZADOR') navigate('/scanner');
      else if (dados.usuario.perfil === 'ADMINISTRADOR') navigate('/eventos');
      else navigate('/dashboard');

    } catch (erro) {
      const msgErro = erro.response?.data?.erro || erro.message || 'Erro ao fazer login';
      setMensagemErro(msgErro);
    } finally {
      setIsCarregando(false);
    }
  };

  const handleCadastroSubmit = async (formDataCadastro) => {
    setMensagemErro('');
    setIsCarregando(true);
    try {
      await api.post('/api/cadastro', formDataCadastro);
      
      alert('Conta criada! Faça login para continuar.');
      setIsLogin(true);
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || erro.message || 'Erro ao cadastrar';
      setMensagemErro(msgErro);
    } finally {
      setIsCarregando(false);
    }
  };

  return (
    <section className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
          <p>
            {isLogin 
              ? 'Acesse seu painel para gerenciar suas presenças.' 
              : 'Junte-se à plataforma e participe de atividades.'}
          </p>
        </div>

        {mensagemErro && <div className="erro-alerta">{mensagemErro}</div>}

        <div className="google-login-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setMensagemErro('O login com o Google falhou.')}
            text={isLogin ? "signin_with" : "signup_with"}
            shape="rectangular"
          />
        </div>
        
        <div style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '1rem' }}>ou</div>

        {isLogin ? (
          <FormLogin onSubmit={handleLoginSubmit} isCarregando={isCarregando} />
        ) : (
          <FormCadastro 
            onSubmit={handleCadastroSubmit} 
            isCarregando={isCarregando} 
            dadosIniciais={dadosIniciaisCadastro} 
          />
        )}

        <div className="auth-footer">
          <p>
            {isLogin ? 'Ainda não tem uma conta? ' : 'Já possui uma conta? '}
            <button 
              type="button" 
              className="btn-toggle-auth" 
              onClick={() => {
                setIsLogin(!isLogin);
                setMensagemErro('');
              }}
              disabled={isCarregando}
            >
              {isLogin ? '  Cadastre-se aqui' : '  Faça login'}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}