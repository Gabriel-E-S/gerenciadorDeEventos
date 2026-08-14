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
      <div className="form-group">
        <label>Tipo de Atividade</label>
        <select
          name="tipoAtividade"
          value={atividadeData.tipoAtividade || ''}
          onChange={(e) => setAtividadeData(prev => ({ ...prev, tipoAtividade: e.target.value }))}
          required
        >
          <option value="" disabled>Selecione o tipo...</option>
          <option value="Palestra">Palestra</option>
          <option value="Minicurso">Minicurso</option>
          <option value="Workshop">Workshop</option>
          <option value="Mesa Redonda">Mesa Redonda</option>
          <option value="Apresentação de Trabalho">Apresentação de Trabalho</option>
          <option value="Visita Técnica">Visita Técnica</option>
          <option value="Outro">Outro</option>
        </select>
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