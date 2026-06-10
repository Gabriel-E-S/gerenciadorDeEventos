
-- Habilita as restrições de checagem no banco -- É NECESSÁRIO NO tiDB!
SET GLOBAL tidb_enable_check_constraint = ON;

CREATE DATABASE IF NOT EXISTS gerenciamento_eventos;
USE gerenciamento_eventos;


CREATE TABLE Usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE CHECK (email LIKE '%@%'), 
    senha VARCHAR(255) NOT NULL,
    fotoUrl VARCHAR(255),        
    cpf VARCHAR(11) UNIQUE CHECK (cpf IS NULL OR (CHAR_LENGTH(cpf) = 11 AND cpf REGEXP '^[0-9]+$')), 
    ra VARCHAR(20) UNIQUE,      
    tipoPerfil ENUM('PARTICIPANTE', 'ORGANIZADOR', 'ADMINISTRADOR') NOT NULL
);


CREATE TABLE Evento (
    id_evento INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario_gerente INT NOT NULL, 
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    dataInicio DATETIME NOT NULL,
    dataFim DATETIME NOT NULL,
    local VARCHAR(255),
    numeroVagas INT,
    FOREIGN KEY (id_usuario_gerente) REFERENCES Usuario(id_usuario) ON DELETE RESTRICT,
    CHECK (numeroVagas IS NULL OR numeroVagas > 0),
    CONSTRAINT chk_evento_datas CHECK (dataFim >= dataInicio)
);

CREATE TABLE Atividade (
    id_atividade INT AUTO_INCREMENT PRIMARY KEY,
    id_evento INT NOT NULL,         
    titulo VARCHAR(150) NOT NULL,
    data DATE NOT NULL,
    horarioInicio TIME NOT NULL,
    horarioFim TIME NOT NULL,
    capacidadeMaxima INT,
    FOREIGN KEY (id_evento) REFERENCES Evento(id_evento) ON DELETE CASCADE, 
    CHECK (capacidadeMaxima IS NULL OR capacidadeMaxima > 0),
    CONSTRAINT chk_atividade_horarios CHECK (horarioFim > horarioInicio)
);

CREATE TABLE InscricaoAtividade (
    id_inscricaoAtividade INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_atividade INT NOT NULL,
    tokenValidacao VARCHAR(255),     
    dataInscricao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_atividade) REFERENCES Atividade(id_atividade) ON DELETE CASCADE,
    UNIQUE KEY uq_usuario_atividade (id_usuario, id_atividade) 
);

CREATE TABLE RegistroPresenca (
    id_registroPresenca INT AUTO_INCREMENT PRIMARY KEY,
    id_inscricaoAtividade INT NOT NULL UNIQUE, 
    id_organizador INT NOT NULL,               
    dataHoraLeitura DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_inscricaoAtividade) REFERENCES InscricaoAtividade(id_inscricaoAtividade) ON DELETE CASCADE,
    FOREIGN KEY (id_organizador) REFERENCES Usuario(id_usuario) ON DELETE RESTRICT
);