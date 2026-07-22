import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; 
import Loader from '../../components/UI/Loader';
import FormularioEvento from '../../components/Admin/FormularioEvento';
import FormularioAtividade from '../../components/Admin/FormularioAtividade';
import './NovoEvento.css'; 

export default function EditarEvento() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const tokenSessao = localStorage.getItem('tokenSessao');
  
  const { usuarioLogado } = useContext(AuthContext);

  const [eventoData, setEventoData] = useState({
    titulo: '', descricao: '', dataInicio: '', dataFim: '', local: '', numeroVagas: '', idOrganizador: ''
  });
  
  const [listaAtividades, setListaAtividades] = useState([]);
  const [listaOrganizadores, setListaOrganizadores] = useState([]); 
  const [carregando, setCarregando] = useState(true);

  const [atividadeEditandoId, setAtividadeEditandoId] = useState(null); 
  const [atividadeData, setAtividadeData] = useState({
    tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
  });

  const [mostrandoFormNova, setMostrandoFormNova] = useState(false);
  const [novaAtividadeData, setNovaAtividadeData] = useState({
    tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
  });

  const [metricas, setMetricas] = useState({ totalInscritos: 0, totalCheckins: 0, taxaComparecimento: 0, numeroVagas: null, taxaOcupacao: null });

  const formatarDataParaInput = (dataSQL) => {
    if (!dataSQL) return '';
    const data = new Date(dataSQL);
    const offset = data.getTimezoneOffset() * 60000;
    return new Date(data.getTime() - offset).toISOString().slice(0, 16); 
  };

  const formatarDataSimples = (dataSQL) => {
    if (!dataSQL) return '';
    return new Date(dataSQL).toISOString().split('T')[0];
  };

  const carregarDados = async () => {
    try {
      
      const resEvento = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}`);
      if (resEvento.ok) {
        const dados = await resEvento.json();
        setEventoData({
          titulo: dados.titulo,
          descricao: dados.descricao || '',
          dataInicio: formatarDataParaInput(dados.dataInicio),
          dataFim: formatarDataParaInput(dados.dataFim),
          local: dados.local || '',
          numeroVagas: dados.numeroVagas || '',
          idOrganizador: dados.id_usuario_gerente || '' 
        });
      } else {
        alert("Evento não encontrado.");
        navigate('/eventos');
        return;
      }

      if (usuarioLogado?.perfil === 'ADMINISTRADOR') {
        const resOrg = await fetch('https://gerenciadordeeventos.onrender.com/api/organizadores', {
          headers: { 'Authorization': `Bearer ${tokenSessao}` }
        });
        if (resOrg.ok) {
          setListaOrganizadores(await resOrg.json());
        }
      }
      const resAtividades = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}/atividades`);
      if (resAtividades.ok) setListaAtividades(await resAtividades.json());

      const resMetricas = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}/estatisticas`);
      if (resMetricas.ok) setMetricas(await resMetricas.json());

    } catch (erro) {
      console.error("Erro ao buscar dados:", erro);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [id, navigate, usuarioLogado]);

  const handleAdicionarStaff = async () => {
    const emailStaff = prompt("Digite o e-mail do aluno que vai ajudar no Scanner:");
    
    if (!emailStaff) return; 

    try {
        const res = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}/equipe`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenSessao}` 
            },
            body: JSON.stringify({ email: emailStaff })
        });
        const data = await res.json();
        
        if(res.ok) alert("ok " + data.mensagem);
        else alert("erro " + data.erro);

    } catch (err) {
        alert("Erro de conexão ao adicionar Staff.");
    }
  };

  const handleSalvarEvento = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenSessao}` },
        body: JSON.stringify(eventoData)
      });
      const dados = await resposta.json();
      if (resposta.ok) alert("Ok " + dados.mensagem);
      else alert("Erro: " + dados.erro);
    } catch (erro) {
      alert("Erro ao salvar o evento principal.");
    }
  };

  const handleSalvarEdicaoAtividade = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch(`https://gerenciadordeeventos.onrender.com/api/atividades/${atividadeEditandoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenSessao}` },
        body: JSON.stringify({
          titulo: atividadeData.tituloAtividade,
          data: atividadeData.dataAtividade,
          horarioInicio: atividadeData.horaInicio,
          horarioFim: atividadeData.horaFim,
          capacidadeMaxima: atividadeData.capacidade
        })
      });
      
      const dados = await resposta.json();
      if (resposta.ok) {
        alert("Ok " + dados.mensagem);
        setAtividadeEditandoId(null); 
        carregarDados(); 
      } else {
        alert("Erro: " + dados.erro);
      }
    } catch (erro) {
      alert("Erro ao atualizar a atividade.");
    }
  };

  const handleCriarNovaAtividade = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch('https://gerenciadordeeventos.onrender.com/api/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenSessao}` },
        body: JSON.stringify({
          id_evento: id, 
          titulo: novaAtividadeData.tituloAtividade,
          data: novaAtividadeData.dataAtividade,
          horarioInicio: novaAtividadeData.horaInicio,
          horarioFim: novaAtividadeData.horaFim,
          capacidadeMaxima: novaAtividadeData.capacidade
        })
      });

      const dados = await resposta.json();
      if (resposta.ok) {
        alert("Nova atividade adicionada com sucesso!");
        setMostrandoFormNova(false); 
        setNovaAtividadeData({ tituloAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: '' }); 
        carregarDados(); 
      } else {
        alert("Erro: " + dados.erro);
      }
    } catch (erro) {
      alert("Erro de conexão ao criar atividade.");
    }
  };

  const handleExcluirAtividade = async (id_atividade) => {
    if (!window.confirm("ATENÇÃO: Isso excluirá esta atividade e as inscrições de todos os alunos. Continuar?")) return;
    try {
      const resposta = await fetch(`https://gerenciadordeeventos.onrender.com/api/atividades/${id_atividade}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenSessao}` }
      });
      if (resposta.ok) {
        alert("Atividade removida.");
        carregarDados(); 
      }
    } catch (erro) { alert("Erro ao excluir."); }
  };

  const handleExcluirEvento = async () => {
    if (!window.confirm("ALERTA: Você está prestes a excluir o EVENTO INTEIRO e todos os dados vinculados a ele. Esta ação é IRREVERSÍVEL. Confirmar?")) return;
    try {
      const resposta = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenSessao}` }
      });
      if (resposta.ok) {
        alert("Evento excluído com sucesso.");
        navigate('/eventos'); 
      }
    } catch (erro) { alert("Erro ao excluir o evento."); }
  };

  const handleExportarRelatorio = async () => {
    try {
      const resposta = await fetch(`https://gerenciadordeeventos.onrender.com/api/eventos/${id}/relatorio`, {
        headers: { 'Authorization': `Bearer ${tokenSessao}` }
      });
      const dados = await resposta.json();
      if (!resposta.ok) { alert("Erro: " + dados.erro); return; }
      if (dados.length === 0) { alert("Não há nenhuma inscrição registrada neste evento ainda."); return; }

      const cabecalhos = Object.keys(dados[0]).join(';');
      const linhas = dados.map(linha => Object.values(linha).map(valor => `"${String(valor).replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(';'));
      const csvString = [cabecalhos, ...linhas].join('\n');

      const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); 
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Relatorio_Evento_${id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (erro) { alert("Erro ao tentar baixar o relatório."); }
  };

  const isDonoOuAdmin = usuarioLogado?.perfil === 'ADMINISTRADOR' || Number(usuarioLogado?.id) === Number(eventoData?.idOrganizador);

  if (carregando) return <Loader mensagem="Carregando painel de edição..." />;

  return (
    <section className="admin-container">
      <div className="admin-card">
        
        <div className="editar-header-top">
          <h2>Editar {eventoData.titulo}</h2>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {isDonoOuAdmin && (
              <button type="button" onClick={handleAdicionarStaff} className="btn-admin-submit btn-adicionar-staff" style={{ backgroundColor: '#10b981' }}>
                + Adicionar Ajudante
              </button>
            )}
            <button type="button" onClick={handleExportarRelatorio} className="btn-admin-submit btn-exportar">
              Exportar Presenças (CSV)
            </button>
          </div>
        </div>

        <div className="metricas-container">
          <div className="metrica-card inscritos">
            <span className="metrica-titulo">Total de Inscrições</span>
            <span className="metrica-valor">{metricas.totalInscritos}</span>
          </div>

          <div className="metrica-card ocupacao">
            <span className="metrica-titulo">Lotação do Evento</span>
            <span className="metrica-valor">
              {metricas.numeroVagas 
                ? `${metricas.taxaOcupacao}% (${metricas.totalInscritos}/${metricas.numeroVagas})` 
                : 'Ilimitada'
              }
            </span>
          </div>
          <div className="metrica-card checkins">
            <span className="metrica-titulo">Check-ins Validados</span>
            <span className="metrica-valor">{metricas.totalCheckins}</span>
          </div>
          <div className="metrica-card taxa">
            <span className="metrica-titulo">Taxa de Presença</span>
            <span className="metrica-valor">{metricas.taxaComparecimento}%</span>
          </div>
        </div>
        
        <FormularioEvento 
          eventoData={eventoData}
          setEventoData={setEventoData}
          onSubmit={handleSalvarEvento}
          isBloqueado={false}
          textoBotao="Salvar Evento"
          listaOrganizadores={listaOrganizadores} 
        />

        <div className="atividades-section">
          <h3>Atividades Programadas</h3>
          
          {listaAtividades.length === 0 ? (
            <p className="atividades-vazia">Nenhuma atividade cadastrada ainda.</p>
          ) : (
            <ul className="lista-edicao-atividades">
              {listaAtividades.map((ativ) => (
                <li key={ativ.id_atividade} className="atividade-item-edit">
                  
                  {atividadeEditandoId === ativ.id_atividade ? (
                    
                    <FormularioAtividade 
                      atividadeData={atividadeData}
                      setAtividadeData={setAtividadeData}
                      onSubmit={handleSalvarEdicaoAtividade}
                      onFinalizar={() => setAtividadeEditandoId(null)}
                      textoBotaoPrincipal="Salvar"
                    />
                  ) : (
                    <div className="atividade-resumo">
                      <div>
                        <strong>{ativ.titulo}</strong>
                        <p>{formatarDataSimples(ativ.data)} • {ativ.horarioInicio} às {ativ.horarioFim}</p>
                        
                        <div className="atividade-estatisticas">
                          <span className="estatistica-pill blue">
                            {ativ.vagasOcupadas || 0} {ativ.capacidadeMaxima ? `/ ${ativ.capacidadeMaxima}` : ''} Inscritos
                          </span>
                          <span className="estatistica-pill green">
                            {ativ.checkinsRealizados || 0} Check-ins
                          </span>
                        </div>
                      </div>

                      <div className="atividade-resumo-actions">
                        <button 
                          className="btn-concluir" 
                          onClick={() => {
                            setAtividadeEditandoId(ativ.id_atividade);
                            setAtividadeData({
                              tituloAtividade: ativ.titulo,
                              dataAtividade: formatarDataSimples(ativ.data),
                              horaInicio: ativ.horarioInicio,
                              horaFim: ativ.horarioFim,
                              capacidade: ativ.capacidadeMaxima || ''
                            });
                          }}
                        >
                          Editar
                        </button>
                        <button className="btn-concluir btn-excluir-outline" onClick={() => handleExcluirAtividade(ativ.id_atividade)}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {mostrandoFormNova ? (
            <div className="nova-atividade-box">
              <h4 className="nova-atividade-titulo">Nova Atividade</h4>
              
              <FormularioAtividade 
                atividadeData={novaAtividadeData}
                setAtividadeData={setNovaAtividadeData}
                onSubmit={handleCriarNovaAtividade}
                onFinalizar={() => setMostrandoFormNova(false)}
                textoBotaoPrincipal="Salvar Nova Atividade"
              />
            </div>
          ) : (
            <button type="button" className="btn-admin-submit btn-secondary btn-add-nova" onClick={() => setMostrandoFormNova(true)}>
              Adicionar Nova Atividade
            </button>
          )}
        </div>

        <div className="editar-footer-actions">
          <button type="button" onClick={() => navigate('/eventos')} className="btn-concluir" style={{ margin: 0 }}>
            Voltar para a Vitrine
          </button>
          <button type="button" onClick={handleExcluirEvento} className="btn-admin-submit btn-excluir-evento">
            Excluir Evento Inteiro
          </button>
        </div>

      </div> 
    </section>
  );
}