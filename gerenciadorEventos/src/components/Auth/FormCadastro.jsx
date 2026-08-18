import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';

export default function FormCadastro({ onSubmit, isCarregando, dadosIniciais }) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [ra, setRa] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState(null);
  const [aceitouTermos, setAceitouTermos] = useState(false);

  useEffect(() => {
    if (dadosIniciais) {
      setNome(dadosIniciais.nome || "");
      setEmail(dadosIniciais.email || "");
    }
  }, [dadosIniciais]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("nome", nome);
    formData.append("cpf", cpf); 
    formData.append("ra", ra); 
    formData.append("email", email);
    formData.append("senha", senha);

    if (fotoPerfil) {
      formData.append("fotoPerfil", fotoPerfil);
    }

    formData.append('termos_aceitos', aceitouTermos);

    if (dadosIniciais && dadosIniciais.google_id) {
        formData.append("google_id", dadosIniciais.google_id);
    }

    onSubmit(formData);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Nome Completo</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Digite seu nome"
          required
          disabled={isCarregando}
        />
      </div>

      <div className="form-group">
        <label>CPF</label>
        <input
          type="text"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="Apenas números ou com pontuação"
          required
          disabled={isCarregando}
        />
      </div>

      <div className="form-group">
        <label>RA (Registro Acadêmico) - Opcional</label>
        <input
          type="text"
          value={ra}
          onChange={(e) => setRa(e.target.value)}
          placeholder="Apenas para alunos da instituição"
          disabled={isCarregando}
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          disabled={isCarregando || (dadosIniciais && dadosIniciais.email)} 
        />
      </div>

      <div className="form-group">
        <label>Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Sua senha para acesso local"
          required
          disabled={isCarregando}
        />
      </div>

      <div className="form-group">
        <label>Foto de Perfil</label>
        <input
          type="file"
          accept="image/png, image/jpeg, image/jpg"
          onChange={(e) => setFotoPerfil(e.target.files[0])}
          required
          disabled={isCarregando}
          style={{ padding: "0.4rem 0" }}
        />
      </div>

      <div className="form-group checkbox-group" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '10px' }}>
        <input 
          type="checkbox" 
          id="termos"
          checked={aceitouTermos} 
          onChange={(e) => setAceitouTermos(e.target.checked)} 
          required 
          disabled={isCarregando}
          style={{ width: 'auto', marginTop: '4px' }}
        />
        <label htmlFor="termos" style={{ fontSize: '0.85rem', lineHeight: '1.4', fontWeight: 'normal' }}>
          Declaro que li e concordo com os <Link to="/termos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-blue)' }}>Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-blue)' }}>Política de Privacidade</Link>, e autorizo o uso dos meus dados e imagem para a gestão do evento.
        </label>
      </div>

      <button type="submit" className="btn-auth-submit" disabled={isCarregando}>
        {isCarregando ? "Criando e enviando foto..." : "Cadastrar"}
      </button>
    </form>
  );
}