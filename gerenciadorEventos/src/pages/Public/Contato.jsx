import React, { useState } from 'react';
import axios from 'axios'; 
import './Contato.css';

export default function Contato() {
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
      const response = await axios.post("https://formspree.io/f/maqzjpbv", formData, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200) {
        setStatus('SUCESSO');
        form.reset(); 
      }
    } catch (error) {
      setStatus('ERRO');
    }
  };

  return (
    <section className="contato-container">
      <h1>CONTATO</h1>
      <p className="contato-subtitulo">Preencha o formulário abaixo e entre em contato com a gente:</p>
      
      <div className="contato-card">
        <form className="contato-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome<span>*</span></label>
            <input type="text" name="nome" placeholder="Digite seu nome" required />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Email<span>*</span></label>
              <input type="email" name="email" placeholder="Digite seu email" required />
            </div>
            <div className="form-group">
              <label>Assunto<span>*</span></label>
              <input type="text" name="assunto" placeholder="Digite o assunto" required />
            </div>
          </div>
          
          <div className="form-group">
            <label>Mensagem<span>*</span></label>
            <textarea name="mensagem" placeholder="Digite sua mensagem" rows="5" required></textarea>
          </div>
          
          <button type="submit" className="btn-enviar">Enviar</button>

          {status === 'SUCESSO' && (
            <p className="msg-sucesso">
              Mensagem enviada com sucesso!
            </p>
          )}
          {status === 'ERRO' && (
            <p className="msg-erro">
              Ops! Ocorreu um erro ao enviar a mensagem. Tente novamente.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}