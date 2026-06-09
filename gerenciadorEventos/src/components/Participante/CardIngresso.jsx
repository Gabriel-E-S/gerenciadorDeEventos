import React from 'react';

export default function CardIngresso({ ingresso, onClick }) {
  const dataF = new Date(ingresso.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  
  return (
    <div className="ingresso-card-item" onClick={onClick}>
      <div className="info-ingresso">
        <span className="badge-evento-tag">{ingresso.titulo_evento}</span>
        
        <h4 className={ingresso.checkinRealizado ? 'texto-riscado' : 'texto-normal'}>
          {ingresso.titulo_atividade}
        </h4>
        <p>Horário: {dataF} às {ingresso.horarioInicio}</p>
      </div>

      <div className={`icone-abrir ${ingresso.checkinRealizado ? 'icone-usado' : ''}`}>
        {ingresso.checkinRealizado ? (
          <span className="texto-sucesso">✓ Utilizado</span>
        ) : (
          <span>Abrir Ingresso: </span>
        )}
      </div>
    </div>
  );
}