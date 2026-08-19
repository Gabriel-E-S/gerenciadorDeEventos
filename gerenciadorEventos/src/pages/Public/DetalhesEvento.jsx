import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api'; 
import CardAtividade from '../../components/Eventos/CardAtividade';
import Loader from '../../components/UI/Loader';
import './Eventos.css'; 

export default function DetalhesEvento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuarioLogado } = useContext(AuthContext); 
  
  const [evento, setEvento] = useState(null);
  const [atividades, setAtividades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [inscricoesUsuario, setInscricoesUsuario] = useState([]); 

  const [carregandoCheckout, setCarregandoCheckout] = useState(false);
  const [statusPagamento, setStatusPagamento] = useState(null);

  useEffect(() => {
    const buscarDados = async () => {
      try {
        const resEvento = await api.get(`/api/eventos/${id}`);
        setEvento(resEvento.data);

        const resAtividades = await api.get(`/api/eventos/${id}/atividades`);
        setAtividades(resAtividades.data);

        if (usuarioLogado) {
          const resIngressos = await api.get('/api/meus-ingressos');
          const idsInscritos = resIngressos.data.map(ing => ing.id_atividade);
          setInscricoesUsuario(idsInscritos);

          const resStatus = await api.get(`/api/eventos/${id}/status-pagamento`);
          setStatusPagamento(resStatus.data.status);
        }

      } catch (erro) {
        if (erro.response?.status === 404) {
          navigate('/eventos');
        } else {
          console.error("Erro ao carregar detalhes:", erro);
        }
      } finally {
        setCarregando(false);
      }
    };

    buscarDados();
  }, [id, navigate, usuarioLogado]);

  const handleComprar = async () => {
    if (!usuarioLogado) {
      alert("Você precisa fazer login para garantir sua inscrição!");
      navigate('/login');
      return;
    }

    setCarregandoCheckout(true);
    try {
      const resposta = await api.post('/api/pagamentos/checkout-pro', { id_evento: id });
      const dados = resposta.data;

      if (dados.status === 'gratis') {
        alert("Ok " + dados.mensagem);
        window.location.reload(); 
      } else if (dados.link_pagamento) {
        window.location.href = dados.link_pagamento;
      }
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro de conexão ao gerar o pagamento.";
      alert("Erro: " + msgErro);
    } finally {
      setCarregandoCheckout(false);
    }
  };

  const handleInscricao = async (id_atividade) => {
    if (!usuarioLogado) {
      alert("Você precisa fazer login para se inscrever!");
      navigate('/login');
      return;
    }

    try {
      await api.post('/api/inscricao', { id_atividade });
      
      alert("Inscrição confirmada!");
      navigate('/dashboard'); 
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro ao processar sua inscrição. Tente novamente.";
      alert("Erro! " + msgErro);
    }
  };

  if (carregando) return <Loader mensagem="Carregando programação do evento..." />;
  if (!evento) return null;

  const podeGerenciar = usuarioLogado && (
    usuarioLogado.perfil === 'ADMINISTRADOR' || 
    Number(usuarioLogado.id) === Number(evento.id_usuario_gerente)
  );

  return (
    <section className="eventos-page">
  
      <div className="detalhes-header">
        
        <div className="detalhes-top-nav">
          <button className="btn-voltar btn-voltar-override" onClick={() => navigate('/eventos')}>
            Voltar aos Eventos
          </button>
          
          {podeGerenciar && (
            <button 
              className="btn-detalhes btn-gerenciar-override" 
              onClick={() => navigate(`/admin/editar-evento/${evento.id_evento}`)}
            >
              Gerenciar Painel do Evento
            </button>
          )}
        </div>

        <div className="detalhes-banner">

          {evento.url_imagem && (
            <div className="detalhes-capa-container">
              <img 
                src={evento.url_imagem} 
                alt="Banner do Evento" 
                className="detalhes-capa-imagem"
              />
            </div>
          )}

          <h1>{evento.titulo}</h1>
          <p className="detalhes-local">Local: {evento.local || 'Local não informado'}</p>
          
          <p className="detalhes-contador-inscritos">
            N° Inscritos: <strong>{evento.totalInscritos || 0}</strong> {evento.totalInscritos === 1 ? 'participante' : 'participantes'}
          </p>

          <div className="detalhes-descricao-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--dark-blue)' }}>Sobre o Evento</h3>
            <p className="detalhes-descricao">
              {evento.descricao || 'Nenhuma descrição detalhada fornecida.'}
            </p>
          </div>

          <div className="area-pagamento-evento" style={{ marginTop: '30px' }}>
            {statusPagamento === 'PAGO' ? (
              <div style={{ padding: '15px 30px', backgroundColor: 'var(--primary-blue)', color: 'white', borderRadius: '8px', fontWeight: 'bold', display: 'inline-block' }}>
                Inscrição Confirmada
              </div>
            ) : (
              <button 
                className="btn-admin-submit" 
                onClick={handleComprar} 
                disabled={carregandoCheckout}
                style={{ backgroundColor: '#10b981', fontSize: '1.1rem', padding: '15px 30px', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}
              >
                {carregandoCheckout 
                  ? "Redirecionando Seguro..." 
                  : evento.preco > 0 
                    ? `Comprar Ingressos (R$ ${Number(evento.preco).toFixed(2).replace('.', ',')})` 
                    : "Garantir Inscrição (Gratuito)"}
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="atividades-lista">
        <h2>Grade de Programação</h2>
        
        {atividades.length === 0 ? (
          <p>Nenhuma atividade cadastrada para este evento ainda.</p>
        ) : (
          <div className="eventos-grid-page">
            {atividades.map(ativ => (
              <CardAtividade 
                key={ativ.id_atividade}
                atividade={ativ}
                jaInscrito={inscricoesUsuario.includes(ativ.id_atividade)}
                onInscrever={handleInscricao}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}