import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api'; 
import Loader from '../../components/UI/Loader';
import CardIngresso from '../../components/Participante/CardIngresso';
import ModalIngresso from '../../components/Participante/ModalIngresso';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [usuarioLogado] = useState(() => {
    const dadosSalvos = localStorage.getItem('dadosUsuario');
    return dadosSalvos ? JSON.parse(dadosSalvos) : null;
  });

  const [ingressos, setIngressos] = useState([]);
  const [ingressoSelecionado, setIngressoSelecionado] = useState(null);
  const [tokenQr, setTokenQr] = useState('');
  const [tempoRestante, setTempoRestante] = useState(15);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }

    const buscarMeusIngressos = async () => {
      try {
        
        const res = await api.get('/api/meus-ingressos');
        setIngressos(res.data);
      } catch (erro) {
        console.error("Erro ao carregar agenda:", erro);
      } finally {
        setCarregando(false);
      }
    };

    buscarMeusIngressos();
  }, [usuarioLogado, navigate]);

  useEffect(() => {
    if (!ingressoSelecionado || ingressoSelecionado.checkinRealizado) return;

    const obterNovoToken = async () => {
      try {
        
        const res = await api.get(`/api/ingresso?id_inscricaoAtividade=${ingressoSelecionado.id_inscricaoAtividade}`);
        
        setTokenQr(res.data.tokenQrCode);
        setTempoRestante(15); 
      } catch (erro) {
        console.error("Erro ao obter token do QR Code:", erro);
      }
    };

    obterNovoToken();

    const relogio = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          obterNovoToken();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(relogio);
  }, [ingressoSelecionado]);

  const handleCancelarInscricao = async () => {
    const confirmar = window.confirm("Tem certeza que deseja cancelar sua inscrição? Esta vaga será devolvida ao sistema imediatamente.");
    if (!confirmar) return;

    try {
      const res = await api.delete(`/api/inscricao/${ingressoSelecionado.id_inscricaoAtividade}`);
      
      alert("Ok " + res.data.mensagem);
      setIngressoSelecionado(null); 
      
      const resLista = await api.get('/api/meus-ingressos');
      setIngressos(resLista.data);
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro ao tentar cancelar a inscrição.";
      alert("Erro: " + msgErro);
    }
  };

  if (carregando) return <Loader mensagem="Carregando sua agenda..." />;

  return (
    <section className="dashboard-container">
      <div className="dashboard-header-welcome">
        <h2>Minha Agenda de Ingressos</h2>
        <p>Toque na atividade desejada para abrir o QR Code de entrada.</p>
      </div>

      <div className="ingressos-lista-full">
        {ingressos.length === 0 ? (
          <p className="txt-vazio">Você ainda não se inscreveu em nenhuma atividade. Visite a aba "Eventos".</p>
        ) : (
          ingressos.map(ing => (
            <CardIngresso 
              key={ing.id_inscricaoAtividade}
              ingresso={ing}
              onClick={() => {
                setIngressoSelecionado(ing);
                setTokenQr('carregando...');
              }}
            />
          ))
        )}
      </div>

      <ModalIngresso 
        ingresso={ingressoSelecionado}
        tokenQr={tokenQr}
        tempoRestante={tempoRestante}
        onClose={() => setIngressoSelecionado(null)}
        onCancelar={handleCancelarInscricao}
      />
      
    </section>
  );
}