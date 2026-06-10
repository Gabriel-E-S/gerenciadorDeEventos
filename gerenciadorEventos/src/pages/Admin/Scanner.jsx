import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import './Scanner.css';

export default function Scanner() {
  const navigate = useNavigate();
  
  const [resultadoScan, setResultadoScan] = useState(null);
  const [participantePendente, setParticipantePendente] = useState(null);
  
  const scannerRef = useRef(null); 
  
  const tokenSessao = localStorage.getItem('tokenSessao');
  const apiUrl = import.meta.env.VITE_API_URL || 'https://gerenciadordeeventos.onrender.com';

  useEffect(() => {
    if (!tokenSessao) {
      navigate('/login');
      return;
    }

    let isUnmounted = false; 

    async function onScanSuccess(decodedText) {
      
      if (scannerRef.current) scannerRef.current.pause(true); 

      try {
        const resposta = await fetch(`${apiUrl}/api/scanner/ler`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenSessao}`
          },
          body: JSON.stringify({ token_lido: decodedText })
        });

        const dados = await resposta.json();

        if (resposta.ok && dados.status === "pendente_confirmacao") {
          
          setParticipantePendente({
            id_inscricaoAtividade: dados.id_inscricaoAtividade,
            ...dados.participante
          });
          setResultadoScan(null); 
        } else {
          
          setResultadoScan({
            status: "erro",
            mensagem: dados.mensagem || dados.erro,
            dados: { nome: "Acesso Negado", documento: "Verifique o QR Code" }
          });
          
          setTimeout(() => {
            if (!isUnmounted) {
              setResultadoScan(null);
              if (scannerRef.current) scannerRef.current.resume();
            }
          }, 3000);
        }
      } catch (erro) {
        console.error("Erro na requisição:", erro);
        setResultadoScan({
          status: "erro",
          mensagem: "Falha de conexão com o servidor.",
          dados: { nome: "-", documento: "-" }
        });
        setTimeout(() => {
          if (!isUnmounted && scannerRef.current) scannerRef.current.resume();
        }, 3000);
      }
    }

    function onScanFailure(error) {
      // Ignora falhas normais do ambiente
    }
    
    const initTimer = setTimeout(() => {
      if (!isUnmounted) {
        scannerRef.current = new Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
          },
          false
        );
        scannerRef.current.render(onScanSuccess, onScanFailure);
      }
    }, 100);

    return () => {
      isUnmounted = true;
      clearTimeout(initTimer);
      
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Aviso: Falha ao limpar a câmera automaticamente.", error);
        });
      }
    };
  }, [navigate, tokenSessao, apiUrl]);

  const handleConfirmarPresenca = async () => {
    try {
      const resposta = await fetch(`${apiUrl}/api/scanner/confirmar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenSessao}`
        },
        body: JSON.stringify({ id_inscricaoAtividade: participantePendente.id_inscricaoAtividade })
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        
        setResultadoScan({
          status: "sucesso",
          mensagem: dados.mensagem,
          dados: { nome: participantePendente.nome, documento: participantePendente.documento }
        });
      } else {
        alert("Erro: " + (dados.mensagem || dados.erro));
      }
    } catch (erro) {
      alert("Erro de rede ao confirmar presença.");
    } finally {

      setParticipantePendente(null);
      setTimeout(() => {
        setResultadoScan(null);
        if (scannerRef.current) scannerRef.current.resume();
      }, 2000); 
    }
  };

  const handleCancelar = () => {
    setParticipantePendente(null);
    if (scannerRef.current) scannerRef.current.resume();
  };

  return (
    <section className="scanner-container">
      <div className="scanner-header">
        <h1>Validação de Entrada</h1>
        <p>Aponte a câmera para o ingresso digital do participante.</p>
      </div>

      <div className="leitor-wrapper">
        <div id="reader"></div>
        
        {resultadoScan && !participantePendente && (
          <div className={`resultado-alerta ${resultadoScan.status === 'erro' ? 'erro-scan' : 'sucesso-scan'}`}>
            <h2>{resultadoScan.status === 'erro' ? 'Erro:' : 'Ok:'} {resultadoScan.mensagem}</h2>
            {resultadoScan.status === 'erro' && (
              <div className="resultado-dados">
                <p><strong>Nome:</strong> {resultadoScan.dados.nome}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {participantePendente && (
        <div className="modal-foto-overlay">
          <div className="modal-foto-content">
            <h3>Confirme a Identidade</h3>
            
            <img 
              src={participantePendente.foto} 
              alt={`Foto de ${participantePendente.nome}`} 
              className="participante-foto-preview"
            />
            
            <div className="participante-info">
              <h2>{participantePendente.nome}</h2>
              <p>Documento: {participantePendente.documento}</p>
            </div>

            <div className="modal-botoes">
              <button className="btn-confirmar-presenca" onClick={handleConfirmarPresenca}>
                Sim, Confirmar Presença
              </button>
              <button className="btn-cancelar-presenca" onClick={handleCancelar}>
                Cancelar / Recusar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}