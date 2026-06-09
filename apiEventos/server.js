const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config(); 

const db = require('./db'); 

const app = express();

app.use(cors());
app.use(express.json());

const verificarToken = (req, res, next) => {
    const headerAuth = req.headers['authorization'];
    const token = headerAuth && headerAuth.split(' ')[1];

    if (!token) {
        return res.status(403).json({ erro: "Acesso negado. Token não fornecido." });
    }

    try {
        const dadosDecodificados = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = dadosDecodificados; 
        next(); 
    } catch (erro) {
        return res.status(401).json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
    }
};


const verificarDonoOuAdmin = async (id_usuario_logado, perfil_logado, id_evento) => {
    
    if (perfil_logado === 'ADMINISTRADOR') return true;

    const [linhas] = await db.execute('SELECT id_usuario_gerente FROM Evento WHERE id_evento = ?', [id_evento]);
    
    if (linhas.length === 0) return false;

    return Number(linhas[0].id_usuario_gerente) === Number(id_usuario_logado);
};

app.get('/api/ingresso', verificarToken, (req, res) => {
    try {
        const id_usuario_logado = req.usuario.id;
        const { id_inscricaoAtividade } = req.query; 

        if (!id_inscricaoAtividade) {
            return res.status(400).json({ erro: "ID da inscrição é obrigatório." });
        }

        const tokenQrCode = jwt.sign(
            { 
                id_usuario: id_usuario_logado,
                id_inscricaoAtividade: Number(id_inscricaoAtividade), 
                tipo: 'qr_code_acesso' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '15s' }
        );

        res.status(200).json({ tokenQrCode });
    } catch (erro) {
        console.error("Erro ao gerar ingresso:", erro);
        res.status(500).json({ erro: "Erro ao gerar o ingresso digital." });
    }
});

app.get('/api/status', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() as data_hora');
        res.json({ 
            status: "ok", 
            mensagem: "API rodando", 
            banco_de_dados: rows[0].data_hora 
        });
    } catch (erro) {
        res.status(500).json({ erro: "API no ar, mas banco caiu." });
    }
});

app.post('/api/cadastro', async (req, res) => {
    const { nome, email, senha, documento } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: "Nome, email e senha são obrigatórios." });
    }

    try {
        const [usuariosExistentes] = await db.execute(
            'SELECT id_usuario FROM Usuario WHERE email = ?',
            [email]
        );

        if (usuariosExistentes.length > 0) {
            return res.status(409).json({ erro: "Este email já está em uso." });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        let cpf = null;
        let ra = null;

        if (documento) {
            const documentoLimpo = documento.replace(/\D/g, ''); 
            if (documentoLimpo.length === 11) {
                cpf = documentoLimpo;
            } else {
                ra = documento; 
            }
        }

        const query = `
            INSERT INTO Usuario (nome, email, senha, cpf, ra, tipoPerfil) 
            VALUES (?, ?, ?, ?, ?, 'PARTICIPANTE')
        `;
        
        await db.execute(query, [nome, email, senhaHash, cpf, ra]);
        res.status(201).json({ mensagem: "Conta criada com sucesso!" });

    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: "Email e senha são obrigatórios." });
    }

    try {
        const [usuarios] = await db.execute(
            'SELECT * FROM Usuario WHERE email = ?',
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ erro: "Email ou senha incorretos." });
        }

        const usuario = usuarios[0]; 
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ erro: "Email ou senha incorretos." });
        }

        const tokenSessao = jwt.sign(
            { 
                id: usuario.id_usuario, 
                perfil: usuario.tipoPerfil 
            },
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }     
        );

        res.status(200).json({
            mensagem: "Login realizado com sucesso!",
            token: tokenSessao,
            usuario: {
                id: usuario.id_usuario,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.tipoPerfil,
                documento: usuario.cpf || usuario.ra
            }
        });

    } catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.post('/api/eventos', verificarToken, async (req, res) => {
    const { titulo, descricao, dataInicio, dataFim, local, numeroVagas } = req.body;
    const id_usuario_gerente = req.usuario.id; 
    const perfil = req.usuario.perfil;

    if (perfil !== 'ORGANIZADOR' && perfil !== 'ADMINISTRADOR') {
        return res.status(403).json({ erro: "Acesso negado. Apenas organizadores podem criar eventos." });
    }

    if (!titulo || !dataInicio || !dataFim) {
        return res.status(400).json({ erro: "Título, data de início e data de fim são obrigatórios." });
    }

    try {
        const query = `
            INSERT INTO Evento (id_usuario_gerente, titulo, descricao, dataInicio, dataFim, local, numeroVagas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            id_usuario_gerente, 
            titulo, 
            descricao || null, 
            dataInicio, 
            dataFim, 
            local || null, 
            numeroVagas || null
        ]);
        
        res.status(201).json({ mensagem: "Evento criado com sucesso!", id_evento: result.insertId });
    } catch (erro) {
        console.error("Erro ao criar evento:", erro);
        res.status(500).json({ erro: "Erro interno ao criar evento." });
    }
});

app.get('/api/eventos', async (req, res) => {
    try {
        const query = 'SELECT * FROM Evento ORDER BY dataInicio ASC';
        const [eventos] = await db.execute(query);
        res.status(200).json(eventos);
    } catch (erro) {
        console.error("Erro ao buscar eventos:", erro);
        res.status(500).json({ erro: "Erro ao carregar a lista de eventos." });
    }
});

app.get('/api/eventos/:id', async (req, res) => {
    try {
        const query = `
            SELECT e.*, 
                   (SELECT COUNT(DISTINCT ia.id_usuario) 
                    FROM InscricaoAtividade ia 
                    JOIN Atividade a ON ia.id_atividade = a.id_atividade 
                    WHERE a.id_evento = e.id_evento) AS totalInscritos
            FROM Evento e 
            WHERE e.id_evento = ?
        `;
        
        const [eventos] = await db.execute(query, [req.params.id]);
        
        if (eventos.length === 0) {
            return res.status(404).json({ erro: "Evento não encontrado." });
        }
        
        res.status(200).json(eventos[0]);
    } catch (erro) {
        console.error("Erro ao buscar evento:", erro);
        res.status(500).json({ erro: "Erro ao carregar os dados do evento." });
    }
});

app.put('/api/eventos/:id', verificarToken, async (req, res) => {
    const { titulo, descricao, dataInicio, dataFim, local, numeroVagas } = req.body;
    const { id } = req.params;

    // Verifica posse
    const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id);
    if (!autorizado) {
        return res.status(403).json({ erro: "Acesso negado. Você só pode editar eventos que você mesmo criou." });
    }

    if (!titulo || !dataInicio || !dataFim) {
        return res.status(400).json({ erro: "Título, data de início e data de fim são obrigatórios." });
    }

    try {
        const dataInicioFormatada = dataInicio.replace('T', ' ');
        const dataFimFormatada = dataFim.replace('T', ' ');

        const query = `
            UPDATE Evento 
            SET titulo = ?, descricao = ?, dataInicio = ?, dataFim = ?, local = ?, numeroVagas = ?
            WHERE id_evento = ?
        `;
        await db.execute(query, [titulo, descricao || null, dataInicioFormatada, dataFimFormatada, local || null, numeroVagas || null, id]);
        
        res.status(200).json({ mensagem: "Evento atualizado com sucesso!" });
    } catch (erro) {
        console.error("Erro ao atualizar evento:", erro);
        res.status(500).json({ erro: "Erro interno ao atualizar evento." });
    }
});

app.post('/api/atividades', verificarToken, async (req, res) => {
    const { id_evento, titulo, data, horarioInicio, horarioFim, capacidadeMaxima } = req.body;

    const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id_evento);
    if (!autorizado) {
        return res.status(403).json({ erro: "Acesso negado. Você não é o administrador deste evento." });
    }

    if (!id_evento || !titulo || !data || !horarioInicio || !horarioFim) {
        return res.status(400).json({ erro: "Todos os campos da atividade são obrigatórios." });
    }

    try {
        const query = `
            INSERT INTO Atividade (id_evento, titulo, data, horarioInicio, horarioFim, capacidadeMaxima)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.execute(query, [id_evento, titulo, data, horarioInicio, horarioFim, capacidadeMaxima || null]);

        res.status(201).json({ mensagem: "Atividade adicionada com sucesso!" });
    } catch (erro) {
        console.error("Erro ao criar atividade:", erro);
        res.status(500).json({ erro: "Erro interno ao criar atividade." });
    }
});

// Rota para buscar as atividades de um evento COM ESTATÍSTICAS INDIVIDUAIS CORRIGIDAS
app.get('/api/eventos/:id/atividades', async (req, res) => {
    try {
        const id_evento = req.params.id;
        
        const query = `
            SELECT 
                a.*,
                COUNT(DISTINCT ia.id_inscricaoAtividade) AS vagasPreenchidas, -- ✨ Alterado para bater com o frontend e com DISTINCT
                COUNT(DISTINCT rp.id_registroPresenca) AS checkinsRealizados   -- ✨ Adicionado DISTINCT para segurança
            FROM Atividade a
            LEFT JOIN InscricaoAtividade ia ON a.id_atividade = ia.id_atividade
            LEFT JOIN RegistroPresenca rp ON ia.id_inscricaoAtividade = rp.id_inscricaoAtividade
            WHERE a.id_evento = ?
            GROUP BY a.id_atividade
            ORDER BY a.data ASC, a.horarioInicio ASC
        `;
        
        const [atividades] = await db.execute(query, [id_evento]);
        res.status(200).json(atividades);
    } catch (erro) {
        console.error("Erro ao buscar atividades:", erro);
        res.status(500).json({ erro: "Erro ao carregar atividades." });
    }
});
app.put('/api/atividades/:id', verificarToken, async (req, res) => {
    const { titulo, data, horarioInicio, horarioFim, capacidadeMaxima } = req.body;
    const { id } = req.params;

    try {
        
        const [ativRes] = await db.execute('SELECT id_evento FROM Atividade WHERE id_atividade = ?', [id]);
        if (ativRes.length === 0) return res.status(404).json({ erro: "Atividade não encontrada." });

        
        const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, ativRes[0].id_evento);
        if (!autorizado) return res.status(403).json({ erro: "Acesso negado." });

        const dataFormatada = data.includes('T') ? data.split('T')[0] : data;

        const query = `
            UPDATE Atividade 
            SET titulo = ?, data = ?, horarioInicio = ?, horarioFim = ?, capacidadeMaxima = ?
            WHERE id_atividade = ?
        `;
        await db.execute(query, [titulo, dataFormatada, horarioInicio, horarioFim, capacidadeMaxima || null, id]);
        
        res.status(200).json({ mensagem: "Atividade atualizada com sucesso!" });
    } catch (erro) {
        console.error("Erro ao atualizar atividade:", erro);
        res.status(500).json({ erro: "Erro interno ao atualizar atividade." });
    }
});

app.get('/api/atividades', async (req, res) => {
    try {
        const query = `
            SELECT a.id_atividade, e.id_evento, a.titulo AS titulo_atividade, a.data, a.horarioInicio, e.titulo AS titulo_evento,
             e.local FROM Atividade a JOIN Evento e ON a.id_evento = e.id_evento 
             ORDER BY a.data ASC, a.horarioInicio ASC
        `;
        const [atividades] = await db.execute(query);
        res.status(200).json(atividades);
    } catch (erro) {
        console.error("Erro ao buscar atividades:", erro);
        res.status(500).json({ erro: "Erro ao carregar a lista de atividades." });
    }
});

app.post('/api/inscricao', verificarToken, async (req, res) => {
    const { id_atividade } = req.body;
    const id_usuario = req.usuario.id;

    try {
        const [atividadeRes] = await db.execute(
            'SELECT capacidadeMaxima, data, horarioFim FROM Atividade WHERE id_atividade = ?', 
            [id_atividade]
        );
        if (atividadeRes.length === 0) return res.status(404).json({ erro: "Atividade não encontrada." });

        const { capacidadeMaxima, data, horarioFim } = atividadeRes[0];

        const dataFormatada = new Date(data).toISOString().split('T')[0];
        const dataHoraFimAtividade = new Date(`${dataFormatada}T${horarioFim}`);
        const agora = new Date();

        if (agora > dataHoraFimAtividade) {
            return res.status(400).json({ 
                erro: "Inscrição recusada! Esta atividade já foi encerrada e não aceita novos participantes." 
            });
        }

        const [inscricaoExistente] = await db.execute(
            'SELECT id_inscricaoAtividade FROM InscricaoAtividade WHERE id_usuario = ? AND id_atividade = ?', 
            [id_usuario, id_atividade]
        );
        if (inscricaoExistente.length > 0) return res.status(400).json({ erro: "Você já realizou a sua inscrição nesta atividade." });

        if (capacidadeMaxima && capacidadeMaxima > 0) {
            const [contagemRes] = await db.execute(
                'SELECT COUNT(*) as totalInscritos FROM InscricaoAtividade WHERE id_atividade = ?', 
                [id_atividade]
            );
            if (contagemRes[0].totalInscritos >= capacidadeMaxima) {
                return res.status(403).json({ erro: "Lotação esgotada! Não há mais vagas para esta atividade." });
            }
        }
        const query = 'INSERT INTO InscricaoAtividade (id_usuario, id_atividade) VALUES (?, ?)';
        await db.execute(query, [id_usuario, id_atividade]);

        res.status(201).json({ mensagem: "Inscrição realizada com sucesso! O QR Code já está no seu Dashboard." });

    } catch (erro) {
        console.error("Erro ao processar inscrição:", erro);
        res.status(500).json({ erro: "Erro interno ao processar a inscrição." });
    }
});

app.get('/api/meus-ingressos', verificarToken, async (req, res) => {
    const id_usuario = req.usuario.id;
    try {
        const query = `
            SELECT 
                i.id_inscricaoAtividade, 
                i.id_atividade,
                a.titulo AS titulo_atividade, 
                a.data, 
                a.horarioInicio, 
                e.titulo AS titulo_evento,
                (rp.id_registroPresenca IS NOT NULL) AS checkinRealizado
            FROM InscricaoAtividade i
            JOIN Atividade a ON i.id_atividade = a.id_atividade
            JOIN Evento e ON a.id_evento = e.id_evento
            LEFT JOIN RegistroPresenca rp ON i.id_inscricaoAtividade = rp.id_inscricaoAtividade
            WHERE i.id_usuario = ?
            ORDER BY a.data ASC, a.horarioInicio ASC
        `;
        const [ingressos] = await db.execute(query, [id_usuario]);
        
        const ingressosFormatados = ingressos.map(ing => ({
            ...ing,
            checkinRealizado: ing.checkinRealizado === 1
        }));

        res.status(200).json(ingressosFormatados);
    } catch (erro) {
        console.error("Erro ao buscar ingressos:", erro);
        res.status(500).json({ erro: "Erro ao carregar a lista de ingressos." });
    }
});

app.post('/api/validar-presenca', verificarToken, async (req, res) => {
    const { token_lido } = req.body;
    const id_organizador = req.usuario.id; 

    let id_inscricao;
    try {
        const dadosDecodificados = jwt.verify(token_lido, process.env.JWT_SECRET);
        id_inscricao = dadosDecodificados.id_inscricaoAtividade;
    } catch (erro) {
        return res.status(400).json({
            status: "erro",
            mensagem: "QR Code expirado ou inválido. Peça para o participante atualizar a tela."
        });
    }

    try {
        const queryToken = `
            SELECT 
                ia.id_inscricaoAtividade,
                ia.id_usuario AS id_participante,
                u.nome AS nome_participante,
                u.ra AS ra_participante,
                a.titulo AS titulo_atividade,
                a.data,
                a.horarioInicio,
                a.horarioFim
            FROM InscricaoAtividade ia
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            JOIN Usuario u ON ia.id_usuario = u.id_usuario
            WHERE ia.id_inscricaoAtividade = ?
        `;

        const [resultados] = await db.execute(queryToken, [id_inscricao]);

        if (resultados.length === 0) {
            return res.status(404).json({ 
                status: "erro", 
                mensagem: "Inscrição não encontrada no banco de dados." 
            });
        }

        const info = resultados[0];

        const TOLERANCIA_ANTES = 15;  
        const TOLERANCIA_DEPOIS = 15; 

        const dataAtividadeStr = new Date(info.data).toISOString().split('T')[0];
        
        const dataHoraInicio = new Date(`${dataAtividadeStr}T${info.horarioInicio}`);
        const dataHoraFim = new Date(`${dataAtividadeStr}T${info.horarioFim}`);
        
        const inicioPermitido = new Date(dataHoraInicio.getTime() - (TOLERANCIA_ANTES * 60 * 1000));
        const fimPermitido = new Date(dataHoraFim.getTime() + (TOLERANCIA_DEPOIS * 60 * 1000));
        
        const agora = new Date();

        if (agora < inicioPermitido) {
            return res.status(400).json({
                status: "erro",
                mensagem: "Muito cedo! O check-in ainda não foi liberado para esta atividade."
            });
        }

        if (agora > fimPermitido) {
            return res.status(400).json({
                status: "erro",
                mensagem: "Prazo encerrado! Esta atividade já terminou e a tolerância de check-in expirou."
            });
        }

        const [presencaExistente] = await db.execute(
            'SELECT id_registroPresenca FROM RegistroPresenca WHERE id_inscricaoAtividade = ?',
            [info.id_inscricaoAtividade]
        );

        if (presencaExistente.length > 0) {
            return res.status(400).json({
                status: "erro",
                mensagem: "Aviso: Este QR Code já foi validado anteriormente!"
            });
        }

        const queryGravarPresenca = `
            INSERT INTO RegistroPresenca (id_inscricaoAtividade, id_organizador) 
            VALUES (?, ?)
        `;
        await db.execute(queryGravarPresenca, [info.id_inscricaoAtividade, id_organizador]);
        
        res.status(200).json({
            mensagem: "Presença confirmada com sucesso!",
            participante: {
                nome: info.nome_participante,
                documento: info.ra_participante ? `RA: ${info.ra_participante}` : `ID: ${info.id_participante}`
            }
        });

    } catch (erro) {
        console.error("Erro ao validar presença no scanner:", erro);
        res.status(500).json({ status: "erro", mensagem: "Erro interno ao processar validação." });
    }
});
app.delete('/api/inscricao/:id_inscricao', verificarToken, async (req, res) => {
    const id_usuario = req.usuario.id;
    const { id_inscricao } = req.params;

    try {
        const [presencas] = await db.execute('SELECT * FROM RegistroPresenca WHERE id_inscricaoAtividade = ?', [id_inscricao]);
        if (presencas.length > 0) return res.status(400).json({ erro: "Cancelamento bloqueado: Seu check-in já foi confirmado." });

        const [resultado] = await db.execute(
            'DELETE FROM InscricaoAtividade WHERE id_inscricaoAtividade = ? AND id_usuario = ?', 
            [id_inscricao, id_usuario]
        );
        
        if (resultado.affectedRows === 0) return res.status(404).json({ erro: "Inscrição não encontrada ou não pertence a você." });
        
        res.status(200).json({ mensagem: "Inscrição cancelada com sucesso. Vaga liberada!" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro interno ao cancelar inscrição." });
    }
});

app.delete('/api/atividades/:id', verificarToken, async (req, res) => {
    try {
        const id_atividade = req.params.id;
        
        // Descobre a qual evento essa atividade pertence
        const [ativRes] = await db.execute('SELECT id_evento FROM Atividade WHERE id_atividade = ?', [id_atividade]);
        if (ativRes.length === 0) return res.status(404).json({ erro: "Atividade não encontrada." });

        // Verifica posse
        const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, ativRes[0].id_evento);
        if (!autorizado) return res.status(403).json({ erro: "Acesso negado. Você não é o administrador deste evento." });
        
        await db.execute('DELETE rp FROM RegistroPresenca rp JOIN InscricaoAtividade ia ON rp.id_inscricaoAtividade = ia.id_inscricaoAtividade WHERE ia.id_atividade = ?', [id_atividade]);
        await db.execute('DELETE FROM InscricaoAtividade WHERE id_atividade = ?', [id_atividade]);
        await db.execute('DELETE FROM Atividade WHERE id_atividade = ?', [id_atividade]);
        
        res.status(200).json({ mensagem: "Atividade e todas as inscrições nela vinculadas foram excluídas." });
    } catch (erro) {
        console.error("Erro ao excluir atividade:", erro);
        res.status(500).json({ erro: "Erro ao excluir a atividade." });
    }
});

app.delete('/api/eventos/:id', verificarToken, async (req, res) => {
    const id_evento = req.params.id;

    const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id_evento);
    if (!autorizado) return res.status(403).json({ erro: "Acesso negado. Você só pode excluir eventos que você mesmo criou." });

    try {
        await db.execute('DELETE rp FROM RegistroPresenca rp JOIN InscricaoAtividade ia ON rp.id_inscricaoAtividade = ia.id_inscricaoAtividade JOIN Atividade a ON ia.id_atividade = a.id_atividade WHERE a.id_evento = ?', [id_evento]);
        await db.execute('DELETE ia FROM InscricaoAtividade ia JOIN Atividade a ON ia.id_atividade = a.id_atividade WHERE a.id_evento = ?', [id_evento]);
        await db.execute('DELETE FROM Atividade WHERE id_evento = ?', [id_evento]);
        await db.execute('DELETE FROM Evento WHERE id_evento = ?', [id_evento]);
        
        res.status(200).json({ mensagem: "O evento foi completamente OBLITERADO e excluído do sistema." });
    } catch (erro) {
        console.error("Erro ao excluir evento:", erro);
        res.status(500).json({ erro: "Erro crítico ao tentar excluir o evento." });
    }
});

app.get('/api/eventos/:id/relatorio', verificarToken, async (req, res) => {
    const { id } = req.params;

    const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id);
    if (!autorizado) return res.status(403).json({ erro: "Acesso negado. Você não tem permissão para extrair relatórios deste evento." });

    try {
        const query = `
            SELECT 
                u.nome AS Participante,
                u.email AS Email,
                COALESCE(u.ra, u.cpf, 'N/I') AS Documento,
                a.titulo AS Atividade,
                DATE_FORMAT(a.data, '%d/%m/%Y') AS Data,
                a.horarioInicio AS Inicio,
                a.horarioFim AS Fim,
                ROUND(TIME_TO_SEC(TIMEDIFF(a.horarioFim, a.horarioInicio)) / 3600, 1) AS CargaHoraria,
                IF(rp.id_registroPresenca IS NOT NULL, 'Presente', 'Ausente') AS Status,
                COALESCE(uo.nome, '-') AS ValidadoPor,
                IF(rp.dataHoraLeitura IS NOT NULL, DATE_FORMAT(rp.dataHoraLeitura, '%d/%m/%Y %H:%i:%s'), '-') AS HorarioValidacao
            FROM InscricaoAtividade ia
            JOIN Usuario u ON ia.id_usuario = u.id_usuario
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            LEFT JOIN RegistroPresenca rp ON ia.id_inscricaoAtividade = rp.id_inscricaoAtividade
            LEFT JOIN Usuario uo ON rp.id_organizador = uo.id_usuario
            WHERE a.id_evento = ?
            ORDER BY a.data ASC, a.horarioInicio ASC, u.nome ASC
        `;
        
        const [relatorio] = await db.execute(query, [id]);
        res.status(200).json(relatorio);
    } catch (erro) {
        console.error("Erro ao gerar relatório:", erro);
        res.status(500).json({ erro: "Erro ao exportar os dados do evento." });
    }
});

app.post('/api/admin/organizadores', verificarToken, async (req, res) => {

    if (req.usuario.perfil !== 'ADMINISTRADOR') {
        return res.status(403).json({ erro: "Acesso negado. Apenas administradores podem cadastrar organizadores." });
    }

    const { nome, email, senha, documento } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: "Nome, email e senha são obrigatórios." });
    }

    try {
        const [usuariosExistentes] = await db.execute('SELECT id_usuario FROM Usuario WHERE email = ?', [email]);
        if (usuariosExistentes.length > 0) {
            return res.status(409).json({ erro: "Este email já está em uso." });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        let cpf = null;
        let ra = null;

        if (documento) {
            const documentoLimpo = documento.replace(/\D/g, ''); 
            if (documentoLimpo.length === 11) {
                cpf = documentoLimpo;
            } else {
                ra = documento; 
            }
        }

        const query = `
            INSERT INTO Usuario (nome, email, senha, cpf, ra, tipoPerfil) 
            VALUES (?, ?, ?, ?, ?, 'ORGANIZADOR')
        `;
        
        await db.execute(query, [nome, email, senhaHash, cpf, ra]);
        res.status(201).json({ mensagem: "Novo organizador cadastrado com sucesso!" });

    } catch (erro) {
        console.error("Erro ao cadastrar organizador:", erro);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Rota para buscar estatísticas gerais de um evento usando RegistroPresenca
app.get('/api/eventos/:id/estatisticas', async (req, res) => {
    try {
        const id_evento = req.params.id;

        const queryInscritos = `
            SELECT COUNT(*) AS totalInscritos 
            FROM InscricaoAtividade ia
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            WHERE a.id_evento = ?
        `;

        const queryCheckins = `
            SELECT COUNT(rp.id_registroPresenca) AS totalCheckins 
            FROM InscricaoAtividade ia
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            JOIN RegistroPresenca rp ON ia.id_inscricaoAtividade = rp.id_inscricaoAtividade
            WHERE a.id_evento = ?
        `;

        const queryEvento = `SELECT numeroVagas FROM Evento WHERE id_evento = ?`;

        const [[resInscritos]] = await db.execute(queryInscritos, [id_evento]);
        const [[resCheckins]] = await db.execute(queryCheckins, [id_evento]);
        const [[resEvento]] = await db.execute(queryEvento, [id_evento]);

        const inscritos = resInscritos.totalInscritos || 0;
        const checkins = resCheckins.totalCheckins || 0;
        const numeroVagas = resEvento.numeroVagas; 
        
        const taxaComparecimento = inscritos > 0 ? Math.round((checkins / inscritos) * 100) : 0;
        
        let taxaOcupacao = null;
        if (numeroVagas > 0) {
            taxaOcupacao = Math.round((inscritos / numeroVagas) * 100);
        }

        res.status(200).json({
            totalInscritos: inscritos,
            totalCheckins: checkins,
            taxaComparecimento: taxaComparecimento,
            numeroVagas: numeroVagas,
            taxaOcupacao: taxaOcupacao
        });
    } catch (erro) {
        console.error("Erro ao gerar estatísticas do evento:", erro);
        res.status(500).json({ erro: "Erro ao carregar métricas do painel." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});