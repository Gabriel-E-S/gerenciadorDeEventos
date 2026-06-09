import React from 'react';

export default function CardEvento({ evento, usuarioLogado, onGerenciar, onVerDetalhes }) {
  const dataInicio = new Date(evento.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const dataFim = new Date(evento.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  
  const isOrganizador = usuarioLogado && 
    (usuarioLogado.perfil === 'ORGANIZADOR' || usuarioLogado.perfil === 'ADMINISTRADOR');

  return (
    <div className="evento-card-page">
      <div className="card-banner">
        <h3>{evento.titulo}</h3>
      </div>
      
      <div className="card-body">
        <p><strong>De:</strong> {dataInicio} <strong>Até:</strong> {dataFim}</p>
        <p><strong>Local:</strong> {evento.local}</p>
        {evento.descricao && (
          <p className="card-descricao-resumo">
            {evento.descricao.length > 80 ? evento.descricao.substring(0, 80) + '...' : evento.descricao}
          </p>
        )}
      </div>
      
      <div className="card-footer">
        {isOrganizador ? (
          <button 
            className="btn-detalhes btn-gerenciar" 
            onClick={() => onGerenciar(evento.id_evento)}
          >
            Gerenciar Evento
          </button>
        ) : (
          <button 
            className="btn-detalhes" 
            onClick={() => onVerDetalhes(evento.id_evento)}
          >
            Ver Detalhes
          </button>
        )}
      </div>
    </div>
  );
}