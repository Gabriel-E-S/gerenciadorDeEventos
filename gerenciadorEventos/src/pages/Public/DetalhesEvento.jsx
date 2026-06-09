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

  useEffect(() => {
    const buscarDados = async () => {
      try {
        const resEvento = await fetch(`http://localhost:3000/api/eventos/${id}`);
        if (resEvento.ok) {
          const dadosEvento = await resEvento.json();
          setEvento(dadosEvento);
        } else {
          navigate('/eventos');
          return;
        }

        const resAtividades = await fetch(`http://localhost:3000/api/eventos/${id}/atividades`);
        if (resAtividades.ok) {
          const dadosAtividades = await resAtividades.json();
          setAtividades(dadosAtividades);
        }

        const tokenSessao = localStorage.getItem('tokenSessao');
        if (tokenSessao) {
          const resIngressos = await fetch('http://localhost:3000/api/meus-ingressos', {
            headers: { 'Authorization': `Bearer ${tokenSessao}` }
          });
          if (resIngressos.ok) {
            const dadosIngressos = await resIngressos.json();
            const idsInscritos = dadosIngressos.map(ing => ing.id_atividade);
            setInscricoesUsuario(idsInscritos);
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


  const handleInscricao = async (id_atividade) => {
    const tokenSessao = localStorage.getItem('tokenSessao');

    if (!tokenSessao) {
      alert("Você precisa fazer login para se inscrever!");
      navigate('/login');
      return;
    }

    try {
      const resposta = await fetch('http://localhost:3000/api/inscricao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify({ id_atividade })
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        alert("Inscrição confirmada! Seu QR Code já está disponível.");
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
          <h1>{evento.titulo}</h1>
          <p className="detalhes-local">Local: {evento.local || 'Local não informado'}</p>
          
          <p className="detalhes-contador-inscritos">
            N° Inscritos: <strong>{evento.totalInscritos || 0}</strong> {evento.totalInscritos === 1 ? 'participante' : 'participantes'}
          </p>

          <p className="detalhes-descricao">{evento.descricao || 'Nenhuma descrição detalhada fornecida.'}</p>
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