import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; 
import api from '../../services/api'; 
import Loader from '../../components/UI/Loader';
import FormularioEvento from '../../components/Admin/FormularioEvento';
import FormularioAtividade from '../../components/Admin/FormularioAtividade';
import './NovoEvento.css'; 

export default function EditarEvento() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  
  const { usuarioLogado } = useContext(AuthContext);

  const [eventoData, setEventoData] = useState({
    titulo: '', descricao: '', dataInicio: '', dataFim: '', local: '', numeroVagas: '', idOrganizador: '', preco: ''
  });
  
  const [imagemEvento, setImagemEvento] = useState(null);
  const [listaAtividades, setListaAtividades] = useState([]);
  const [listaOrganizadores, setListaOrganizadores] = useState([]); 
  const [carregando, setCarregando] = useState(true);

  const [atividadeEditandoId, setAtividadeEditandoId] = useState(null); 
  const [atividadeData, setAtividadeData] = useState({
    tituloAtividade: '', tipoAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
  });

  const [mostrandoFormNova, setMostrandoFormNova] = useState(false);
  const [novaAtividadeData, setNovaAtividadeData] = useState({
    tituloAtividade: '', tipoAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: ''
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
      const resEvento = await api.get(`/api/eventos/${id}`);
      const dados = resEvento.data;
      
      setEventoData({
        titulo: dados.titulo,
        descricao: dados.descricao || '',
        dataInicio: formatarDataParaInput(dados.dataInicio),
        dataFim: formatarDataParaInput(dados.dataFim),
        local: dados.local || '',
        numeroVagas: dados.numeroVagas || '',
        idOrganizador: dados.id_usuario_gerente || '',
        preco: dados.preco !== null && dados.preco !== undefined ? dados.preco : ''
      });

      if (usuarioLogado?.perfil === 'ADMINISTRADOR') {
        const resOrg = await api.get('/api/organizadores');
        setListaOrganizadores(resOrg.data);
      }
      
      const resAtividades = await api.get(`/api/eventos/${id}/atividades`);
      setListaAtividades(resAtividades.data);

      const resMetricas = await api.get(`/api/eventos/${id}/estatisticas`);
      setMetricas(resMetricas.data);

    } catch (erro) {
      if (erro.response?.status === 404) {
        alert("Evento não encontrado.");
        navigate('/eventos');
      } else {
        console.error("Erro ao buscar dados:", erro);
      }
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
      const res = await api.post(`/api/eventos/${id}/equipe`, { email: emailStaff });
      alert("Ok " + res.data.mensagem);
    } catch (err) {
      const msgErro = err.response?.data?.erro || "Erro de conexão ao adicionar Staff.";
      alert("Erro: " + msgErro);
    }
  };

  const handleSalvarEvento = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('titulo', eventoData.titulo);
      formData.append('descricao', eventoData.descricao);
      formData.append('dataInicio', eventoData.dataInicio);
      formData.append('dataFim', eventoData.dataFim);
      formData.append('local', eventoData.local);
      formData.append('numeroVagas', eventoData.numeroVagas);
      formData.append('preco', eventoData.preco || 0);
      
      if (imagemEvento) {
        formData.append('imagem', imagemEvento);
      }

      const resposta = await api.put(`/api/eventos/${id}`, formData);
      alert("Ok " + resposta.data.mensagem);
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro ao salvar o evento principal.";
      alert("Erro: " + msgErro);
    }
  };

  const handleSalvarEdicaoAtividade = async (e) => {
    e.preventDefault();
    try {
      const resposta = await api.put(`/api/atividades/${atividadeEditandoId}`, {
        titulo: atividadeData.tituloAtividade,
        tipo: atividadeData.tipoAtividade,
        data: atividadeData.dataAtividade,
        horarioInicio: atividadeData.horaInicio,
        horarioFim: atividadeData.horaFim,
        capacidadeMaxima: atividadeData.capacidade
      });
      
      alert("Ok " + resposta.data.mensagem);
      setAtividadeEditandoId(null); 
      carregarDados(); 
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro ao atualizar a atividade.";
      alert("Erro: " + msgErro);
    }
  };

  const handleCriarNovaAtividade = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/atividades', {
        id_evento: id, 
        titulo: novaAtividadeData.tituloAtividade,
        tipo: novaAtividadeData.tipoAtividade,
        data: novaAtividadeData.dataAtividade,
        horarioInicio: novaAtividadeData.horaInicio,
        horarioFim: novaAtividadeData.horaFim,
        capacidadeMaxima: novaAtividadeData.capacidade
      });

      alert("Nova atividade adicionada com sucesso!");
      setMostrandoFormNova(false); 
      setNovaAtividadeData({ tituloAtividade: '', tipoAtividade: '', dataAtividade: '', horaInicio: '', horaFim: '', capacidade: '' }); 
      carregarDados(); 
      
    } catch (erro) {
      const msgErro = erro.response?.data?.erro || "Erro de conexão ao criar atividade.";
      alert("Erro: " + msgErro);
    }
  };

  const handleExcluirAtividade = async (id_atividade) => {
    if (!window.confirm("ATENÇÃO: Isso excluirá esta atividade e as inscrições de todos os alunos. Continuar?")) return;
    try {
      await api.delete(`/api/atividades/${id_atividade}`);
      alert("Atividade removida.");
      carregarDados(); 
    } catch (erro) { 
      alert("Erro ao excluir atividade."); 
    }
  };

  const handleExcluirEvento = async () => {
    if (!window.confirm("ALERTA: Você está prestes a excluir o EVENTO INTEIRO e todos os dados vinculados a ele. Esta ação é IRREVERSÍVEL. Confirmar?")) return;
    try {
      await api.delete(`/api/eventos/${id}`);
      alert("Evento excluído com sucesso.");
      navigate('/eventos'); 
    } catch (erro) { 
      alert("Erro ao excluir o evento."); 
    }
  };

  const handleExportarRelatorio = async () => {
    try {
      const resposta = await api.get(`/api/eventos/${id}/relatorio`);
      const dados = resposta.data;
      
      if (dados.length === 0) { 
        alert("Não há nenhuma inscrição registrada neste evento ainda."); 
        return; 
      }

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
      
    } catch (erro) { 
      const msgErro = erro.response?.data?.erro || "Erro ao tentar baixar o relatório.";
      alert("Erro: " + msgErro); 
    }
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
          setImagemEvento={setImagemEvento} 
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
                        <p style={{ color: 'var(--primary-blue)', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '2px' }}>
                          {ativ.tipo || 'Geral'}
                        </p>
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
                              tipoAtividade: ativ.tipo || '', 
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