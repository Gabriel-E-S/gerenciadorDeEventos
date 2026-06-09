import React from 'react';

export default function FormularioAtividade({
  atividadeData,
  setAtividadeData,
  onSubmit,
  onFinalizar,
  textoBotaoPrincipal = "+ Adicionar Atividade",
  textoBotaoSecundario = "Cancelar"
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setAtividadeData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="admin-form">
      <div className="form-group">
        <label>Nome da Atividade (Palestra/Minicurso)</label>
        <input 
          type="text" 
          name="tituloAtividade"
          value={atividadeData?.tituloAtividade || ''} 
          onChange={handleChange} 
          required 
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Data</label>
          <input 
            type="date" 
            name="dataAtividade"
            value={atividadeData?.dataAtividade || ''} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Horário Início</label>
          <input 
            type="time" 
            name="horaInicio"
            value={atividadeData?.horaInicio || ''} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Horário Fim</label>
          <input 
            type="time" 
            name="horaFim"
            value={atividadeData?.horaFim || ''} 
            onChange={handleChange} 
            required 
          />
        </div>
      </div>
      <div className="form-group capacidade-group">
        <label className="capacidade-label">
          Capacidade de Participantes
        </label>
        <input 
          type="number" 
          className="capacidade-input" 
          name="capacidade"
          value={atividadeData?.capacidade || ''} 
          onChange={handleChange} 
          placeholder="Ex: 50"
        />
      </div>
      
      <div className="botoes-inline" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button type="submit" className="btn-admin-submit btn-secondary" style={{ margin: 0 }}>
          {textoBotaoPrincipal}
        </button>
        
        {onFinalizar && (
          <button 
            type="button" 
            onClick={onFinalizar} 
            className="btn-concluir"
            style={{ margin: 0 }}
          >
            {textoBotaoSecundario}
          </button>
        )}
      </div>
    </form>
  );
}