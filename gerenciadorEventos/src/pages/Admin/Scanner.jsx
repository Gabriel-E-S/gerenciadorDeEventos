import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import './Scanner.css';

export default function Scanner() {
  const navigate = useNavigate();
  const [resultadoScan, setResultadoScan] = useState(null);
  
  const tokenSessao = localStorage.getItem('tokenSessao');

  useEffect(() => {
    if (!tokenSessao) {
      navigate('/login');
      return;
    }

    let isUnmounted = false; 
    let scanner = null;

    async function onScanSuccess(decodedText) {
      if (scanner) scanner.pause(true); 

      try {
        const resposta = await fetch('http://localhost:3000/api/validar-presenca', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenSessao}`
          },
          body: JSON.stringify({ token_lido: decodedText })
        });

        const dados = await resposta.json();

        if (resposta.ok) {
          setResultadoScan({
            status: "sucesso",
            mensagem: dados.mensagem,
            dados: dados.participante
          });
        } else {
          setResultadoScan({
            status: "erro",
            mensagem: dados.mensagem || dados.erro,
            dados: { nome: "Acesso Negado", documento: "Verifique o QR Code" }
          });
        }
      } catch (erro) {
        console.error("Erro na requisição:", erro);
        setResultadoScan({
          status: "erro",
          mensagem: "Falha de conexão com o servidor.",
          dados: { nome: "-", documento: "-" }
        });
      }

      setTimeout(() => {
        if (!isUnmounted) {
          setResultadoScan(null);
          if (scanner) scanner.resume();
        }
      }, 3000);
    }

    function onScanFailure(error) {
      // Ignora falhas normais de leitura do ambiente
    }
    
    const initTimer = setTimeout(() => {
      if (!isUnmounted) {
        scanner = new Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
          },
          false
        );
        scanner.render(onScanSuccess, onScanFailure);
      }
    }, 100);

    return () => {
      isUnmounted = true;
      clearTimeout(initTimer);
      
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Aviso: A biblioteca falhou ao limpar a câmera automaticamente.", error);
        });
      }
    };
  }, [navigate, tokenSessao]);

  return (
    <section className="scanner-container">
      <div className="scanner-header">
        <h1>Validação de Entrada</h1>
        <p>Aponte a câmera para o ingresso digital do participante.</p>
      </div>

      <div className="leitor-wrapper">
        <div id="reader"></div>
        
        {resultadoScan && (
          <div className={`resultado-alerta ${resultadoScan.status === 'erro' ? 'erro-scan' : ''}`}>
            <h2>{resultadoScan.status === 'erro' ? 'Erro' : 'Ok'} {resultadoScan.mensagem}</h2>
            <div className="resultado-dados">
              <p><strong>Nome:</strong> {resultadoScan.dados.nome}</p>
              <p><strong>Documento:</strong> {resultadoScan.dados.documento}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}