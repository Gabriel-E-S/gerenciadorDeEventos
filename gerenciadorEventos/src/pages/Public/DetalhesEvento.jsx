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

  const [dadosPix, setDadosPix] = useState(null);
  const [carregandoPix, setCarregandoPix] = useState(false);

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
        }

      } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarDados();
  }, [id, navigate]);

  const handleGerarPix = async () => {
    const tokenSessao = localStorage.getItem('tokenSessao');
    if (!tokenSessao) {
      alert("Você precisa fazer login para garantir sua inscrição!");
      navigate('/login');
      return;
    }

    setCarregandoPix(true);
    try {
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/pagamentos/pix', {
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
        } else {
          setDadosPix({
            qr_code_base64: dados.qr_code_base64,
            qr_code_copia_cola: dados.qr_code,
            id_transacao: dados.id_transacao
          });
        }
      } else {
        alert("Erro: " + dados.erro);
      }
    } catch (erro) {
      alert("Erro de conexão ao gerar o pagamento.");
    } finally {
      setCarregandoPix(false);
    }
  };

  const copiarPix = () => {
    navigator.clipboard.writeText(dadosPix.qr_code_copia_cola);
    alert("Código PIX Copia e Cola copiado para a área de transferência!");
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

          <div className="area-pagamento-evento" style={{ marginTop: '30px' }}>
            {!dadosPix ? (
              <button 
                className="btn-admin-submit" 
                onClick={handleGerarPix} 
                disabled={carregandoPix}
                style={{ backgroundColor: '#10b981', fontSize: '1.1rem', padding: '15px 30px', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}
              >
                {carregandoPix 
                  ? "Gerando cobrança..." 
                  : evento.preco > 0 
                    ? `Garantir Inscrição (R$ ${Number(evento.preco).toFixed(2).replace('.', ',')})` 
                    : "Garantir Inscrição (Gratuito)"}
              </button>
            ) : (
              <div className="caixa-pix-gerado" style={{ backgroundColor: '#ffffff', color: '#1e293b', padding: '25px', border: '2px  #10b981', borderRadius: '12px', maxWidth: '450px', margin: '0 auto', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <h3 style={{ color: '#10b981', margin: '0 0 10px 0' }}>Escaneie o QR Code para pagar</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>O acesso às atividades será liberado automaticamente após a aprovação do pagamento.</p>
                
                <img 
                  src={`data:image/jpeg;base64,${dadosPix.qr_code_base64}`} 
                  alt="QR Code PIX" 
                  style={{ width: '220px', height: '220px', margin: '0 auto', display: 'block', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                
                <div style={{ marginTop: '20px', textAlign: 'left' }}>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0' }}>Ou use o PIX Copia e Cola:</p>
                  <input 
                    type="text" 
                    value={dadosPix.qr_code_copia_cola} 
                    readOnly 
                    style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                  <button className="btn-concluir" onClick={copiarPix} style={{ width: '100%', backgroundColor: '#3b82f6' }}>
                    📄 Copiar Código
                  </button>
                </div>
              </div>
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