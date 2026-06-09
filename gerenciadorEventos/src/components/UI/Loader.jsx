import React from 'react';
import './Loader.css';

export default function Loader({ mensagem = "Carregando dados..." }) {
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <span className="loader-text">{mensagem}</span>
    </div>
  );
}