import React from 'react';

export default function FormularioEvento({
  eventoData,
  setEventoData,
  onSubmit,
  isBloqueado,
  textoBotao,
  listaOrganizadores = [] 
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEventoData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="admin-form">
      <div className="form-group">
        <label>Título do Evento</label>
        <input 
          type="text" 
          name="titulo"
          value={eventoData.titulo || ''} 
          onChange={handleChange} 
          disabled={isBloqueado} 
          required 
        />
      </div>

      <div className="form-group">
        <label>Organizador Responsável</label>
        <select 
          name="idOrganizador" 
          value={eventoData.idOrganizador || ''} 
          onChange={handleChange} 
          disabled={isBloqueado} 
          required
        >
          <option value="" disabled>Selecione um organizador...</option>
          {listaOrganizadores.map(org => (
            <option key={org.id_usuario} value={org.id_usuario}>
              {org.nome} ({org.email})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Descrição</label>
        <textarea 
          name="descricao"
          value={eventoData.descricao || ''} 
          onChange={handleChange} 
          disabled={isBloqueado} 
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Data/Hora Início</label>
          <input 
            type="datetime-local" 
            name="dataInicio"
            value={eventoData.dataInicio || ''} 
            onChange={handleChange} 
            disabled={isBloqueado} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Data/Hora Fim</label>
          <input 
            type="datetime-local" 
            name="dataFim"
            value={eventoData.dataFim || ''} 
            onChange={handleChange} 
            disabled={isBloqueado} 
            required 
          />
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Local</label>
          <input 
            type="text" 
            name="local"
            value={eventoData.local || ''} 
            onChange={handleChange} 
            disabled={isBloqueado} 
          />
        </div>
        <div className="form-group">
          <label>Vagas Totais</label>
          <input 
            type="number" 
            name="numeroVagas"
            value={eventoData.numeroVagas || ''} 
            onChange={handleChange} 
            disabled={isBloqueado} 
          />
        </div>
      </div>
      
      {!isBloqueado && (
        <button type="submit" className="btn-admin-submit">
          {textoBotao}
        </button>
      )}
    </form>
  );
}