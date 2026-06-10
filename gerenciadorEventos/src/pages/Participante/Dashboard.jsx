import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
        const tokenSessao = localStorage.getItem('tokenSessao');
        const res = await fetch('https://gerenciadordeeventos.onrender.com/api/meus-ingressos', {
          headers: { 'Authorization': `Bearer ${tokenSessao}` }
        });
        if (res.ok) {
          const dados = await res.json();
          setIngressos(dados);
        }
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

    const tokenSessao = localStorage.getItem('tokenSessao');

    const obterNovoToken = async () => {
      try {
        const res = await fetch(`https://gerenciadordeeventos.onrender.com/api/ingresso?id_inscricaoAtividade=${ingressoSelecionado.id_inscricaoAtividade}`, {
          headers: { 'Authorization': `Bearer ${tokenSessao}` }
        });
        if (res.ok) {
          const dados = await res.json();
          setTokenQr(dados.tokenQrCode);
          setTempoRestante(15); 
        }
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
      const tokenSessao = localStorage.getItem('tokenSessao');
      const res = await fetch(`https://gerenciadordeeventos.onrender.com/api/inscricao/${ingressoSelecionado.id_inscricaoAtividade}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenSessao}` }
      });
      const dados = await res.json();
      
      if (res.ok) {
        alert("Ok " + dados.mensagem);
        setIngressoSelecionado(null); 
        const resLista = await fetch('https://gerenciadordeeventos.onrender.com/api/meus-ingressos', { headers: { 'Authorization': `Bearer ${tokenSessao}` }});
        setIngressos(await resLista.json());
      } else {
        alert("Erro " + dados.erro);
      }
    } catch (erro) {
      alert("Erro ao tentar cancelar a inscrição.");
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