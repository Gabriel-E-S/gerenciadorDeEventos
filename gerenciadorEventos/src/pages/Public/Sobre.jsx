import React from 'react';
import './Sobre.css';

export default function Sobre() {
  return (
    <section className="sobre-container">
      <div className="sobre-imagem"></div>

      <div className="sobre-texto">
        <h1>Sobre</h1>
        <p>Nossa plataforma foi feita para transformar a forma como você cria, compartilha e participa de eventos acadêmicos e corporativos.</p>
        <p>Aqui, qualquer pessoa ou instituição pode gerenciar seus eventos em poucos minutos, recebendo inscrições em tempo real com ferramentas confiáveis de validação.</p>
        <p>Ao organizar eventos conosco, você foca no que importa: conectar pessoas e criar momentos inesquecíveis na prática.</p>
        
        <p className='paragrafo-chamativo'>Deixe a parte complicada com a gente!</p>
      </div>
    </section>
  );
}