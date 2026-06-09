import React from 'react';
import './CardAtividade.css';

export default function CardAtividade({ atividade, jaInscrito, onInscrever }) {
  const dataF = new Date(atividade.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const limite = atividade.capacidadeMaxima;
  const inscritos = atividade.vagasPreenchidas || 0;
  
  const dataLimpa = atividade.data.split('T')[0]; 
  const dataHoraFim = new Date(`${dataLimpa}T${atividade.horarioFim}`);
  const agora = new Date();
  const atividadeEncerrada = agora > dataHoraFim;

  let porcentagem = 0;
  let textoVagas = "Vagas Ilimitadas";
  let esgotado = false;

  if (limite && limite > 0) {
    porcentagem = Math.min((inscritos / limite) * 100, 100);
    textoVagas = `${inscritos} de ${limite} vagas preenchidas`;
    if (inscritos >= limite) esgotado = true;
  }

  let classeBotao = 'btn-inscrever';
  let textoBotao = 'Inscrever-se';
  
  if (jaInscrito) {
    classeBotao += ' inscrito';
    textoBotao = 'Já Inscrito';
  } else if (atividadeEncerrada) {
    classeBotao += ' esgotado'; 
    textoBotao = 'Atividade Encerrada';
  } else if (esgotado) {
    classeBotao += ' esgotado';
    textoBotao = 'Lotação Esgotada';
  }

  return (
    <div className="evento-card-page">
      <div className="card-body">
        
        <h3 className="atividade-titulo">{atividade.titulo}</h3>
        
        <p><strong>Data:</strong> {dataF}</p>
        <p><strong>Horário:</strong> {atividade.horarioInicio} às {atividade.horarioFim}</p>
        
        {limite > 0 && (
          <div className="vagas-container">
            <span className="vagas-text">{textoVagas}</span>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${esgotado ? 'esgotado' : 'normal'}`} 
                style={{ width: `${porcentagem}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="card-footer">
        <button 
          className={classeBotao} 
          onClick={() => onInscrever(atividade.id_atividade)}
          disabled={esgotado || jaInscrito || atividadeEncerrada} 
        >
          {textoBotao}
        </button>
      </div>
    </div>
  );
}