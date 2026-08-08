import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
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
        const resEvento = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}`);
        if (resEvento.ok) {
          const dadosEvento = await resEvento.json();
          setEvento(dadosEvento);
        } else {
          navigate('/eventos');
          return;
        }

        const resAtividades = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}/atividades`);
        if (resAtividades.ok) {
          const dadosAtividades = await resAtividades.json();
          setAtividades(dadosAtividades);
        }

        const tokenSessao = localStorage.getItem('tokenSessao');
        if (tokenSessao) {
          
          const resIngressos = await fetch('https://gerenciadordeeventos.onrender.com/api/meus-ingressos', {
            headers: { 'Authorization': `Bearer ${tokenSessao}` }
          });
          if (resIngressos.ok) {
            const dadosIngressos = await resIngressos.json();
            const idsInscritos = dadosIngressos.map(ing => ing.id_atividade);
            setInscricoesUsuario(idsInscritos);
          }

          const resStatus = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}/status-pagamento`, {
            headers: { 'Authorization': `Bearer ${tokenSessao}` }
          });
          
          if (resStatus.ok) {
            const dadosStatus = await resStatus.json();
            setStatusPagamento(dadosStatus.status);
          }
        }

      } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarDados();
  }, [id, navigate]);

  const handleComprar = async () => {
    const tokenSessao = localStorage.getItem('tokenSessao');
    if (!tokenSessao) {
      alert("Você precisa fazer login para garantir sua inscrição!");
      navigate('/login');
      return;
    }

    setCarregandoCheckout(true);
    try {
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/pagamentos/checkout-pro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify({ id_evento: id })
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        if (dados.status === 'gratis') {
          alert("🎉 " + dados.mensagem);
          window.location.reload(); 
        } else if (dados.link_pagamento) {
          // Redireciona para o ambiente seguro do Mercado Pago
          window.location.href = dados.link_pagamento;
        }
      } else {
        alert("Erro: " + dados.erro);
      }
    } catch (erro) {
      alert("Erro de conexão ao gerar o pagamento.");
    } finally {
      setCarregandoCheckout(false);
    }
  };

  const handleInscricao = async (id_atividade) => {
    const tokenSessao = localStorage.getItem('tokenSessao');

    if (!tokenSessao) {
      alert("Você precisa fazer login para se inscrever!");
      navigate('/login');
      return;
    }

    try {
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/inscricao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify({ id_atividade })
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        alert("Inscrição confirmada!");
        navigate('/dashboard'); 
      } else {
        alert("Erro! " + dados.erro);
      }
    } catch (erro) {
      alert("Erro ao processar sua inscrição. Tente novamente.");
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

          <p className="detalhes-descricao">{evento.descricao || 'Nenhuma descrição detalhada fornecida.'}</p>

          <div className="area-pagamento-evento" style={{ marginTop: '30px' }}>
            {statusPagamento === 'PAGO' ? (
              <div style={{ padding: '15px 30px', backgroundColor: 'var(--primary-blue)', color: 'white', borderRadius: '8px', fontWeight: 'bold', display: 'inline-block' }}>
                ✅ Inscrição Confirmada
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