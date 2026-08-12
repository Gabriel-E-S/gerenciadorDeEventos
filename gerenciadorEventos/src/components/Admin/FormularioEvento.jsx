import React from "react";

export default function FormularioEvento({
  eventoData,
  setEventoData,
  setImagemEvento,
  onSubmit,
  isBloqueado,
  textoBotao,
  listaOrganizadores = [],
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEventoData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImagemEvento(e.target.files[0]);
    }
  };

  return (
    <form onSubmit={onSubmit} className="admin-form">
      <div className="form-group">
        <label>Título do Evento</label>
        <input
          type="text"
          name="titulo"
          value={eventoData.titulo || ""}
          onChange={handleChange}
          disabled={isBloqueado}
          required
        />
      </div>

      <div className="form-group">
        <label>Organizador Responsável</label>
        <select
          name="idOrganizador"
          value={eventoData.idOrganizador || ""}
          onChange={handleChange}
          disabled={isBloqueado}
          required
        >
          <option value="" disabled>
            Selecione um organizador...
          </option>
          {listaOrganizadores.map((org) => (
            <option key={org.id_usuario} value={org.id_usuario}>
              {org.nome} ({org.email})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Capa do Evento (Imagem)</label>
        <input
          type="file"
          accept="image/jpeg, image/png, image/webp"
          onChange={handleFileChange}
          disabled={isBloqueado}
        />
        <small
          style={{
            color: "#64748b",
            fontSize: "0.8rem",
            marginTop: "4px",
            display: "block",
          }}
        >
          Recomendado: Imagens em alta resolução. O sistema fará o recorte
          automático para 16:9.
        </small>
      </div>

      <div className="form-group">
        <label>Descrição</label>
        <textarea
          name="descricao"
          value={eventoData.descricao || ""}
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
            value={eventoData.dataInicio || ""}
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
            value={eventoData.dataFim || ""}
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
            value={eventoData.local || ""}
            onChange={handleChange}
            disabled={isBloqueado}
          />
        </div>

        <div className="form-group">
          <label>Preço do Ingresso (R$)</label>
          <input
            type="number"
            name="preco"
            step="0.01" 
            min="0" 
            value={eventoData.preco || ""}
            onChange={handleChange}
            disabled={isBloqueado}
            placeholder="Ex: 50.00 (Deixe em branco ou 0 para Grátis)"
          />
          <small
            style={{
              color: "#64748b",
              fontSize: "0.8rem",
              marginTop: "4px",
              display: "block",
            }}
          >
            Digite 0 para evento gratuito.
          </small>
        </div>
        <div className="form-group">
          <label>Vagas Totais</label>
          <input
            type="number"
            name="numeroVagas"
            value={eventoData.numeroVagas || ""}
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
