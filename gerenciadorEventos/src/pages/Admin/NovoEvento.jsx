import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api'; 
import FormularioEvento from '../../components/Admin/FormularioEvento';
import FormularioAtividade from '../../components/Admin/FormularioAtividade';
import './NovoEvento.css';

export default function NovoEvento() {
  const navigate = useNavigate();
  
  const [idEventoCriado, setIdEventoCriado] = useState(null);
  const [listaOrganizadores, setListaOrganizadores] = useState([]); 

  const [eventoData, setEventoData] = useState({
    titulo: '', descricao: '', dataInicio: '', dataFim: '', local: '', numeroVagas: '', idOrganizador: '', preco: ''
  });
  
  const [imagemEvento, setImagemEvento] = useState(null);

  const [atividadeData, setAtividadeData] = useState({
    tituloAtividade: '', tipoAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
  });

  useEffect(() => {
    async function fetchOrganizadores() {
      try {
        const res = await api.get('/api/organizadores');
        const data = res.data;
        
        setListaOrganizadores(data);
        
        if(data.length > 0) {
          setEventoData(prev => ({ ...prev, idOrganizador: data[0].id_usuario }));
        }
      } catch (error) {
        console.error("Erro ao carregar organizadores:", error);
      }
    }
    fetchOrganizadores();
  }, []); 

  const handleCriarEvento = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('titulo', eventoData.titulo);
      formData.append('descricao', eventoData.descricao);
      formData.append('dataInicio', eventoData.dataInicio);
      formData.append('dataFim', eventoData.dataFim);
      formData.append('local', eventoData.local);
      formData.append('numeroVagas', eventoData.numeroVagas);
      formData.append('idOrganizador', eventoData.idOrganizador);
      formData.append('preco', eventoData.preco || 0);
      
      if (imagemEvento) {
        formData.append('imagem', imagemEvento);
      }

      const resposta = await api.post('/api/eventos', formData);

      setIdEventoCriado(resposta.data.id_evento);
      alert("Evento criado! Agora, adicione as atividades dele abaixo.");
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro ao criar o evento.";
      alert("Erro: " + msgErro);
      console.error(erro);
    }
  };

  const handleAdicionarAtividade = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/atividades', {
        id_evento: idEventoCriado,
        titulo: atividadeData.tituloAtividade,
        tipo: atividadeData.tipoAtividade,
        data: atividadeData.dataAtividade,
        horarioInicio: atividadeData.horaInicio,
        horarioFim: atividadeData.horaFim,
        capacidadeMaxima: atividadeData.capacidade
      });

      alert("Atividade adicionada com sucesso!");
      setAtividadeData({
        tituloAtividade: '', tipoAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
      });
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro ao adicionar atividade.";
      alert("Erro: " + msgErro);
      console.error(erro);
    }
  };

  return (
    <section className="admin-container">
      <div className="admin-card">
        <h2>Painel do Administrador - Novo Evento</h2>
        
        <FormularioEvento 
          eventoData={eventoData}
          setEventoData={setEventoData}
          setImagemEvento={setImagemEvento} 
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
                    tituloAtividade: '', tipoAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
                  })}
                  textoBotaoPrincipal="Salvar Nova Atividade"
                  textoBotaoSecundario="Cancelar / Limpar"
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