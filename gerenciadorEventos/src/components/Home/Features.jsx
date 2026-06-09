
import React from 'react';
import './Features.css';

export default function Features() {
  const features = [
    { id: 1, title: 'QR Code Dinâmico', desc: 'Prevenção contra fraudes e prints com atualização em tempo real.' },
    { id: 2, title: 'Leitura Rápida', desc: 'Validação instantânea pela câmera do celular do organizador.' },
    { id: 3, title: 'Relatórios Completos', desc: 'Auditoria de quem liberou o acesso e horário exato da entrada.' }
  ];

  return (
    <section className="features-section" id="features">
      <h2 className="section-title">Por que usar nosso sistema?</h2>
      <div className="features-grid">
        {features.map((feat) => (
          <div key={feat.id} className="feature-card">
            <h3>{feat.title}</h3>
            <p>{feat.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}