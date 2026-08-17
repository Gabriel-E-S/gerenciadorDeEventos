import React, { useState, useEffect, useContext } from 'react'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google'; 
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

  const apiUrl =  'https://gerenciadordeeventos.onrender.com';

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsCarregando(true);
    setMensagemErro('');
    
    try {
        const resposta = await fetch(`${apiUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_google: credentialResponse.credential })
        });
        
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || 'Erro na integração com Google');

        if (dados.acao === 'login') {
            login(dados.usuario, dados.token);
            if (dados.usuario.perfil === 'ORGANIZADOR') navigate('/scanner');
            else if (dados.usuario.perfil === 'ADMINISTRADOR') navigate('/eventos');
            else navigate('/dashboard');
            
        } else if (dados.acao === 'completar_cadastro') {
            setDadosIniciaisCadastro(dados.dados_sugeridos);
            setIsLogin(false);
            alert("Quase lá! Preencha os dados restantes e escolha sua foto para finalizar o cadastro.");
        }
    } catch (erro) {
        setMensagemErro(erro.message);
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
      const resposta = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(dadosLogin)
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Erro ao fazer login');

      login(dados.usuario, dados.token); 
      alert('Login realizado com sucesso!');
      
      if (dados.usuario.perfil === 'ORGANIZADOR') navigate('/scanner');
      else if (dados.usuario.perfil === 'ADMINISTRADOR') navigate('/eventos');
      else navigate('/dashboard');

    } catch (erro) {
      setMensagemErro(erro.message);
    } finally {
      setIsCarregando(false);
    }
  };

  const handleCadastroSubmit = async (formDataCadastro) => {
    setMensagemErro('');
    setIsCarregando(true);
    try {
      const resposta = await fetch(`${apiUrl}/api/cadastro`, {
        method: 'POST',
        body: formDataCadastro
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Erro ao cadastrar');

      alert('Conta criada! Faça login para continuar.');
      setIsLogin(true);
    } catch (erro) {
      setMensagemErro(erro.message);
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