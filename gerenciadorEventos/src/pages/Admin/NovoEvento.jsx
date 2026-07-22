import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormularioEvento from '../../components/Admin/FormularioEvento';
import FormularioAtividade from '../../components/Admin/FormularioAtividade';
import './NovoEvento.css';

export default function NovoEvento() {
  const navigate = useNavigate();
  const tokenSessao = localStorage.getItem('tokenSessao');
  const [idEventoCriado, setIdEventoCriado] = useState(null);
  const [idOrganizador, setIdOrganizador] = useState('');
  const [listaOrganizadores, setListaOrganizadores] = useState([]); 

  const [eventoData, setEventoData] = useState({
    titulo: '', descricao: '', dataInicio: '', dataFim: '', local: '', numeroVagas: ''
  });

  const [atividadeData, setAtividadeData] = useState({
    tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
  });

  useEffect(() => {
    async function fetchOrganizadores() {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/organizadores`, {
            headers: { 'Authorization': `Bearer ${tokenSessao}` }
        });
        const data = await res.json();
        setListaOrganizadores(data);
        if(data.length > 0) setIdOrganizador(data[0].id_usuario); 
    }
    fetchOrganizadores();
  }, []);

  const handleCriarEvento = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/eventos', {
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
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/atividades', {
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
          listaOrganizadores={listaOrganizadores}
          textoBotao="Salvar Evento"
        />

        {idEventoCriado && (
          <>
            <div className="atividades-section">
              <div className="nova-atividade-box">
                <h4 className="nova-atividade-titulo">Nova Atividade</h4>
                
                <FormularioAtividade 
                  atividadeData={atividadeData}
                  setAtividadeData={setAtividadeData}
                  onSubmit={handleAdicionarAtividade}
          
                  onFinalizar={() => setAtividadeData({
                    tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
                  })}
                  textoBotaoPrincipal="Salvar Nova Atividade"
                  textoBotaoSecundario="Cancelar/ Limpar"
                />
              </div>
            </div>

            <div className="editar-footer-actions">
              <button 
                type="button" 
                onClick={() => navigate('/eventos')} 
                className="btn-concluir" 
              >
                Voltar para a Vitrine
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}