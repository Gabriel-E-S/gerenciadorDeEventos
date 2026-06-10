import React, { useState, useEffect, useContext } from 'react'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
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

  const apiUrl =  'https://gerenciadordeeventos.onrender.com';

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
        headers: { 'Content-Type': 'application/json' }, // Login continua JSON
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

        {isLogin ? (
          <FormLogin onSubmit={handleLoginSubmit} isCarregando={isCarregando} />
        ) : (
          <FormCadastro onSubmit={handleCadastroSubmit} isCarregando={isCarregando} />
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