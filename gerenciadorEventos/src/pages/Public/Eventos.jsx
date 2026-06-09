import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import CardEvento from '../../components/Eventos/CardEvento';
import Loader from '../../components/UI/Loader';
import './Eventos.css';

export default function Eventos() {
  const navigate = useNavigate();
  const { usuarioLogado } = useContext(AuthContext);
  const [listaEventos, setListaEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroSituacao, setFiltroSituacao] = useState('ATIVOS'); 

  useEffect(() => {
    const buscarEventos = async () => {
      try {
        const resposta = await fetch('http://localhost:3000/api/eventos');
        if (resposta.ok) {
          const dados = await resposta.json();
          setListaEventos(dados);
        }
      } catch (erro) {
        console.error("Erro de conexão:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarEventos();
  }, []);

  const handleGerenciar = (id_evento) => {
    navigate(`/admin/editar-evento/${id_evento}`);
  };

  const handleVerDetalhes = (id_evento) => {
    navigate(`/eventos/${id_evento}`);
  };

  const dataHoje = new Date();
  
  const eventosFiltrados = listaEventos.filter((evento) => {
    const dataFimEvento = new Date(evento.dataFim);
    let visivelPorData = true;

    if (filtroSituacao === 'ATIVOS') visivelPorData = dataFimEvento >= dataHoje;
    if (filtroSituacao === 'PASSADOS') visivelPorData = dataFimEvento < dataHoje;

    if (!visivelPorData) return false;

    if (usuarioLogado && usuarioLogado.perfil === 'ORGANIZADOR') {
      return evento.id_usuario_gerente === usuarioLogado.id;
    }

    return true;
  });

  return (
    <section className="eventos-page">
      <div className="eventos-header">
        <h1>Eventos Disponíveis</h1>
        
        <div className="filtro-container">
          <label className="filtro-label">Filtrar por:</label>
          <select 
            value={filtroSituacao} 
            onChange={(e) => setFiltroSituacao(e.target.value)}
            className="filtro-select"
          >
            <option value="ATIVOS">Eventos Ativos/Futuros</option>
            <option value="PASSADOS">Eventos Encerrados</option>
            <option value="TODOS">Todos os Eventos</option>
          </select>
        </div>
      </div>

      {carregando ? (
        <Loader mensagem="Carregando eventos disponíveis..." />
      ) : (
        <div className="eventos-grid-page">
  
          {eventosFiltrados.length === 0 ? (
            
            <p className="grid-mensagem-vazia">
              Nenhum evento encontrado para este filtro.
            </p>
          ) : (
            eventosFiltrados.map(evento => (

              <CardEvento 
                key={evento.id_evento}
                evento={evento}
                usuarioLogado={usuarioLogado}
                onGerenciar={handleGerenciar}
                onVerDetalhes={handleVerDetalhes}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}