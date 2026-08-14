import React from 'react';
import './Termos.css';

export default function TermosDeUso() {
  return (
    <section className="documento-container">
      <div className="documento-card">
        <h1>Termos de Uso</h1>
        <p className="ultima-atualizacao">Última atualização: 14 de agosto de 2026</p>

        <p>Ao se cadastrar em nossa plataforma, você concorda com as seguintes regras de utilização:</p>

        <h2>1. O Serviço</h2>
        <p>Nossa plataforma é uma ferramenta tecnológica que facilita a gestão de inscrições, credenciamento e controle de acesso a eventos.</p>

        <h2>2. Suas Responsabilidades</h2>
        <ul>
          <li><strong>Veracidade dos Dados:</strong> Você é responsável por fornecer informações reais e atualizadas. A emissão de certificados com dados incorretos por erro de preenchimento é de sua responsabilidade.</li>
          <li><strong>Segurança da Conta:</strong> A sua senha é de uso pessoal e intransferível. Não compartilhe com terceiros.</li>
          <li><strong>Conduta:</strong> Esperamos que o uso da plataforma seja feito com respeito. Contas que utilizem dados falsos ou tentem fraudar o sistema serão banidas.</li>
        </ul>

        <h2>3. Pagamentos e Reembolsos</h2>
        <p>A política de cancelamento, devolução do dinheiro ou transferência de titularidade do ingresso é de <strong>responsabilidade exclusiva do organizador do evento</strong>, devendo o participante entrar em contato direto com a equipe responsável para tratar destes casos. O sistema apenas facilita a transação tecnológica.</p>
      </div>
    </section>
  );
}