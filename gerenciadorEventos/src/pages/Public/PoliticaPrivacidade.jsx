import React from 'react';
import './Termos.css'; 

export default function PoliticaPrivacidade() {
  return (
    <section className="documento-container">
      <div className="documento-card">
        <h1>Política de Privacidade</h1>
        <p className="ultima-atualizacao">Última atualização: 14 de agosto de 2026</p>

        <p>A sua privacidade é importante para nós. Esta Política de Privacidade explica como o nosso sistema coleta, usa e protege os seus dados pessoais.</p>

        <h2>1. Dados que Coletamos</h2>
        <p>Para que você possa utilizar nossa plataforma, coletamos as seguintes informações durante o cadastro:</p>
        <ul>
          <li><strong>Dados de Identificação:</strong> Nome completo, CPF e RA (Registro Acadêmico, opcional para público externo).</li>
          <li><strong>Dados de Contato e Acesso:</strong> E-mail e senha criptografada.</li>
          <li><strong>Mídia:</strong> Foto de perfil (usada somente para identificação visual).</li>
          <li><strong>Dados de Pagamento:</strong> O processamento financeiro é realizado de forma segura por terceiros (Mercado Pago). Nós não armazenamos os dados do seu cartão de crédito ou qualquer outro tipo de informação bancária.</li>
        </ul>

        <h2>2. Como Usamos os Seus Dados</h2>
        <p>Os dados coletados são utilizados estritamente para as seguintes finalidades:</p>
        <ul>
          <li>Viabilizar a sua inscrição em eventos e atividades.</li>
          <li>Controlar o acesso aos locais via QR Code e identificar você junto à organização.</li>
          <li>Emitir certificados de participação contendo sua carga horária, nome e documento (CPF/RA).</li>
          
        </ul>

        <h2>3. Compartilhamento de Dados</h2>
        <p>Os seus dados não são vendidos ou comercializados. Eles podem ser compartilhados apenas com os <strong>Organizadores dos Eventos</strong> nos quais você se inscreveu (para gestão de presença) e fornecedores de tecnologia (como provedores de servidor em nuvem e pagamento).</p>

        <h2>4. Seus Direitos (LGPD)</h2>
        <p>Você tem o direito de acessar, corrigir ou solicitar a exclusão total dos seus dados da nossa base a qualquer momento. Caso solicite a exclusão, ela será atendida, exceto para dados que precisem ser mantidos para cumprimento de obrigação legal.</p>
      </div>
    </section>
  );
}