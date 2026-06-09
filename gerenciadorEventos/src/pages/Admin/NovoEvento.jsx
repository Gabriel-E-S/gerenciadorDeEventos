import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormularioEvento from '../../components/Admin/FormularioEvento';
import FormularioAtividade from '../../components/Admin/FormularioAtividade';
import './NovoEvento.css';

export default function NovoEvento() {
  const navigate = useNavigate();
  const tokenSessao = localStorage.getItem('tokenSessao');
  const [idEventoCriado, setIdEventoCriado] = useState(null);

  const [eventoData, setEventoData] = useState({
    titulo: '', descricao: '', dataInicio: '', dataFim: '', local: '', numeroVagas: ''
  });

  const [atividadeData, setAtividadeData] = useState({
    tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
  });

  const handleCriarEvento = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch('http://localhost:3000/api/eventos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify(eventoData)
      });

      const dados = await resposta.json();
      if (resposta.ok) {
        setIdEventoCriado(dados.id_evento);
        alert("Evento criado! Agora, adicione as atividades dele abaixo.");
      } else {
        alert("Erro: " + dados.erro);
      }
    } catch (erro) {
      console.error(erro);
    }
  };

  const handleAdicionarAtividade = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch('http://localhost:3000/api/atividades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify({
          id_evento: idEventoCriado,
          titulo: atividadeData.tituloAtividade,
          data: atividadeData.dataAtividade,
          horarioInicio: atividadeData.horaInicio,
          horarioFim: atividadeData.horaFim,
          capacidadeMaxima: atividadeData.capacidade
        })
      });

      const dados = await resposta.json();
      if (resposta.ok) {
        alert("Atividade adicionada com sucesso!");
        setAtividadeData({
          tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
        });
      } else {
        alert("Erro: " + dados.erro);
      }
    } catch (erro) {
      console.error(erro);
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card">
        <h2>Painel do Organizador - Novo Evento</h2>
        
        <FormularioEvento 
          eventoData={eventoData}
          setEventoData={setEventoData}
          onSubmit={handleCriarEvento}
          isBloqueado={idEventoCriado !== null}
          textoBotao="Salvar Evento"
        />

        {idEventoCriado && (
          <div className="atividades-section">
            <h3>Adicionar Atividades ao Evento</h3>
            <FormularioAtividade 
              atividadeData={atividadeData}
              setAtividadeData={setAtividadeData}
              onSubmit={handleAdicionarAtividade}
              onFinalizar={() => navigate('/eventos')}
              textoBotaoSecundario="Finalizar e Ir para a Vitrine" 
            />
          </div>
        )}
      </div>
    </section>
  );
}