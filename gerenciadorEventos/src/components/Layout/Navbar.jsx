import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();

  const { usuarioLogado, logout } = useContext(AuthContext);
  
  const [menuAberto, setMenuAberto] = useState(false);
  const fecharMenu = () => setMenuAberto(false);

  const handleLogout = () => {
    logout(); 
    fecharMenu();
    navigate('/login'); 
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/" onClick={fecharMenu}><h1>Aki</h1></Link>
      </div>

      <button 
        className="menu-toggle" 
        onClick={() => setMenuAberto(!menuAberto)}
        aria-label="Abrir menu"
      >
        {menuAberto ? '✕' : '☰'}
      </button>

      <div className={`navbar-menu-container ${menuAberto ? 'aberto' : ''}`}>
        
        <ul className="navbar-links">
    
        {usuarioLogado?.perfil === 'ORGANIZADOR' ? (
          <>
            <li><Link to="/eventos" onClick={fecharMenu}>Gerenciar Eventos</Link></li>
            <li><Link to="/admin/novo-evento" onClick={fecharMenu}>Criar Evento</Link></li>
            <li><Link to="/scanner" onClick={fecharMenu}>Scanner</Link></li>
          </>
        ) : usuarioLogado?.perfil === 'ADMINISTRADOR' ? (
          
          <>  
            <li><Link to="/eventos" onClick={fecharMenu}>Gerenciar Eventos</Link></li>
            <li><Link to="/admin/novo-evento" onClick={fecharMenu}>Criar Evento</Link></li>
            <li><Link to="/scanner" onClick={fecharMenu}>Scanner</Link></li>
            <li><Link to="/admin/organizadores" onClick={fecharMenu}>+ Equipe</Link></li>
          </>
        ) : usuarioLogado?.perfil === 'PARTICIPANTE' ? (
          
          <>
            <li><Link to="/eventos" onClick={fecharMenu}>Explorar Eventos</Link></li>
            <li><Link to="/dashboard" onClick={fecharMenu}>Minha Agenda</Link></li>
          </>
        ) : (
          
          <>
            <li><Link to="/" onClick={fecharMenu}>Início</Link></li>
            <li><Link to="/eventos" onClick={fecharMenu}>Explorar Eventos</Link></li>
            <li><Link to="/sobre" onClick={fecharMenu}>Sobre</Link></li>
            <li><Link to="/contato" onClick={fecharMenu}>Contato</Link></li>
          </>
        )}
      </ul>

        <div className="navbar-auth">
          {usuarioLogado ? (
            <>
              <span className="saudacao">Olá, {usuarioLogado.nome?.split(' ')[0]}</span>
              
              <button onClick={handleLogout} className="btn-register btn-sair">Sair</button>
            </>
          ) : (
            <>
              <Link to="/login" state={{ modoLogin: true }} className="btn-login" onClick={fecharMenu}>Entrar</Link>
              <Link to="/login" state={{ modoLogin: false }} className="btn-register" onClick={fecharMenu}>Criar Conta</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}