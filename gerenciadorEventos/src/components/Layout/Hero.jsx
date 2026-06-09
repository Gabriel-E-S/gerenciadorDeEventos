import React from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';

export default function Hero() {
  return (
    <section className="hero-container">
      <div className="hero-content">
        <h1>Gestão de Presença Inteligente</h1>
        <p>Valide inscrições, controle o acesso com QR Code dinâmico e acompanhe dados em tempo real para o seu encontro acadêmico ou corporativo.</p>
        <Link to="/login" state={{ modoLogin: true }} className="hero-cta">Vamos começar!</Link>
      </div>
      
      <img 
        className="hero-image" 
        src="https://images.unsplash.com/photo-1503551723145-6c040742065b-v2?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8d29ya3Nob3B8ZW58MHx8MHx8fDI%3D" 
        alt="Demonstração do sistema de gestão de presença com QR Code" 
      />
    </section>
  );
}