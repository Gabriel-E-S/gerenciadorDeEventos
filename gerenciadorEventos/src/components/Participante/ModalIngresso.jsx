import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function ModalIngresso({ 
  ingresso, 
  tokenQr, 
  tempoRestante, 
  onClose, 
  onCancelar 
}) {
  if (!ingresso) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="btn-fechar-modal" onClick={onClose}>
          ✕ Fechar
        </button>
        
        <div className="ticket-top-info">
          <h3>{ingresso.titulo_atividade}</h3>
          <p>{ingresso.titulo_evento}</p>
        </div>

        <div className="qrcode-visual-container">
          {ingresso.checkinRealizado ? (
            <div className="checkin-sucesso-view">
              <div className="circulo-verde">✓</div>
              <h4>Presença Confirmada!</h4>
              <p>Sua entrada nesta atividade já foi validada pelo organizador. Aproveite o evento!</p>
            </div>
          ) : (
            <>
              {tokenQr === 'carregando...' ? (
                <div className="qrcode-loading-placeholder">
                  <p>Criptografando...</p>
                </div>
              ) : (
                <QRCodeSVG value={tokenQr} size={220} level={"H"} />
              )}
              
              <div className="timer-badge-box">
                <p>Atualizando em: <strong>{tempoRestante}s</strong></p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(tempoRestante / 15) * 100}%` }}
                  ></div>
                </div>
              </div>

              <button onClick={onCancelar} className="btn-cancelar-ingresso">
                Desistir da Vaga
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}