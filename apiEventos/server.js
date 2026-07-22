const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config(); 

const db = require('./db'); 

const multer = require('multer');
const cloudinary = require('cloudinary').v2;


const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });

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

    const [linhas] = await db.execute('SELECT idOrganizador FROM Evento WHERE id_evento = ?', [id_evento]);
    
    if (linhas.length === 0) return false;

    return Number(linhas[0].idOrganizador) === Number(id_usuario_logado);
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

// Rota de cadastro.
app.post('/api/cadastro', upload.single('fotoPerfil'), async (req, res) => {
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

        let fotoUrl = null;

        if (req.file) {
            fotoUrl = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { 
                        folder: 'eventos_perfil',
                        format: 'jpg',
                        transformation: [{ width: 400, height: 400, crop: 'fill' }] 
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
        }

        const query = `
            INSERT INTO Usuario (nome, email, senha, cpf, ra, tipoPerfil, fotoUrl) 
            VALUES (?, ?, ?, ?, ?, 'PARTICIPANTE', ?)
        `;
        
        await db.execute(query, [nome, email, senhaHash, cpf, ra, fotoUrl]);
        res.status(201).json({ mensagem: "Conta criada com sucesso!" });

    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// Rota para o participante fazer upload da sua foto
app.post('/api/usuario/foto', verificarToken, upload.single('fotoPerfil'), async (req, res) => {
    try {
        const id_usuario = req.usuario.id;
        
        // Verifica se a foto realmente chegou do Frontend
        if (!req.file) {
            return res.status(400).json({ erro: "Nenhuma foto foi enviada." });
        }

        // ✅ Transmite a imagem da memória RAM direto para o Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                folder: 'eventos_perfil',
                format: 'jpg', // Padroniza o formato para evitar bugs
                transformation: [{ width: 400, height: 400, crop: 'fill' }] 
            },
            async (error, result) => {
                // Esse bloco só roda quando a nuvem termina de processar a foto
                if (error) {
                    console.error("Erro no Cloudinary:", error);
                    return res.status(500).json({ erro: "Falha ao enviar imagem para a nuvem." });
                }
                
                const urlImagem = result.secure_url; 
                
                // Salva a URL oficial gerada no banco de dados
                await db.execute('UPDATE Usuario SET fotoUrl = ? WHERE id_usuario = ?', [urlImagem, id_usuario]);

                return res.status(200).json({ 
                    mensagem: "Foto atualizada com sucesso!", 
                    fotoUrl: urlImagem 
                });
            }
        );

        // Dispara o arquivo para o Cloudinary iniciar o upload
        uploadStream.end(req.file.buffer);

    } catch (erro) {
        console.error("Erro no upload:", erro);
        res.status(500).json({ erro: "Erro interno ao processar a imagem." });
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

        const [equipe] = await db.execute('SELECT id_evento FROM EquipeEvento WHERE id_usuario = ? LIMIT 1', [usuario.id_usuario]);
        const isStaff = equipe.length > 0;

        res.status(200).json({
            mensagem: "Login realizado com sucesso!",
            token: tokenSessao,
            usuario: {
                id: usuario.id_usuario,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.tipoPerfil,
                isStaff: isStaff,
                documento: usuario.cpf || usuario.ra
            }
        });

    } catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

app.post('/api/eventos', verificarToken, async (req, res) => {
    const { titulo, descricao, dataInicio, dataFim, local, numeroVagas, idOrganizador } = req.body;
    const perfil = req.usuario.perfil;

    if (perfil !== 'ADMINISTRADOR') {
        return res.status(403).json({ erro: "Acesso negado. Apenas administradores podem criar eventos." });
    }

    if (!titulo || !dataInicio || !dataFim || !idOrganizador) {
        return res.status(400).json({ erro: "Título, datas e Organizador são obrigatórios." });
    }

    try {
        const query = `
            INSERT INTO Evento (id_usuario_gerente, titulo, descricao, dataInicio, dataFim, local, numeroVagas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `; 
        const [result] = await db.execute(query, [
            idOrganizador, titulo, descricao || null, dataInicio, dataFim, local || null, numeroVagas || null
        ]);
        
        res.status(201).json({ mensagem: "Evento criado com sucesso!", id_evento: result.insertId });
    } catch (erro) {
        console.error("Erro ao criar evento:", erro);
        
        const msgErro = erro.sqlMessage || erro.message || "";
        if (msgErro.includes('chk_evento_datas')) return res.status(400).json({ erro: "A data de fim não pode ser anterior ao início." });
        if (msgErro.includes('numeroVagas')) return res.status(400).json({ erro: "O número de vagas deve ser maior que zero." });

        res.status(500).json({ erro: "Erro interno do servidor: " + msgErro });
    }
});

app.get('/api/organizadores', verificarToken, async (req, res) => {
    if (req.usuario.perfil !== 'ADMINISTRADOR') return res.status(403).json({ erro: "Acesso negado." });
    try {
        const [organizadores] = await db.execute('SELECT id_usuario, nome, email FROM Usuario WHERE tipoPerfil = "ORGANIZADOR"');
        res.status(200).json(organizadores);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar organizadores." });
    }
});

app.post('/api/eventos/:id/equipe', verificarToken, async (req, res) => {
    const id_evento = req.params.id;
    const { email } = req.body;

    const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id_evento);
    if (!autorizado) return res.status(403).json({ erro: "Apenas o organizador do evento pode adicionar equipe." });

    try {
        const [usuarios] = await db.execute('SELECT id_usuario, nome FROM Usuario WHERE email = ?', [email]);
        if (usuarios.length === 0) return res.status(404).json({ erro: "Usuário não encontrado. Peça para a pessoa criar uma conta no sistema primeiro." });
        
        const id_novo_staff = usuarios[0].id_usuario;

        await db.execute('INSERT IGNORE INTO EquipeEvento (id_evento, id_usuario) VALUES (?, ?)', [id_evento, id_novo_staff]);
        
        res.status(200).json({ mensagem: `${usuarios[0].nome} agora faz parte do Staff do evento!` });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao adicionar membro à equipe." });
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
        
        const msgErro = erro.sqlMessage || erro.message || "";
        if (msgErro.includes('chk_evento_datas')) {
            return res.status(400).json({ erro: "A data e hora de fim do evento não podem ser anteriores ao início." });
        }
        if (msgErro.includes('numeroVagas')) {
            return res.status(400).json({ erro: "O número de vagas deve ser maior que zero." });
        }

        res.status(500).json({ erro: "Erro interno do servidor: " + msgErro });
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
        
        const msgErro = erro.sqlMessage || erro.message || "";
        
        if (msgErro.includes('chk_atividade_horarios')) {
            return res.status(400).json({ erro: "O horário de término não pode ser anterior ou igual ao horário de início." });
        }
        if (msgErro.includes('capacidadeMaxima')) {
            return res.status(400).json({ erro: "A capacidade de participantes deve ser um número maior que zero." });
        }

        res.status(500).json({ erro: "Erro interno do servidor: " + msgErro });
    }
});

// Rota para buscar as atividades de um evento COM ESTATÍSTICAS INDIVIDUAIS CORRIGIDAS
app.get('/api/eventos/:id/atividades', async (req, res) => {
    try {
        const id_evento = req.params.id;
        
        const query = `
            SELECT 
                a.*,
                COUNT(DISTINCT ia.id_inscricaoAtividade) AS vagasPreenchidas, 
                COUNT(DISTINCT rp.id_registroPresenca) AS checkinsRealizados   
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
        
        const msgErro = erro.sqlMessage || erro.message || "";

        if (msgErro.includes('chk_atividade_horarios')) {
            return res.status(400).json({ erro: "O horário de término não pode ser anterior ou igual ao horário de início." });
        }
        if (msgErro.includes('capacidadeMaxima')) {
            return res.status(400).json({ erro: "A capacidade de participantes deve ser um número maior que zero." });
        }

        res.status(500).json({ erro: "Erro interno do servidor: " + msgErro });
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
        const dataHoraFimAtividade = new Date(`${dataFormatada}T${horarioFim}-03:00`); // Foi preciso fazer isso pq o servidor está em fuso horário diferente ;/
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

app.post('/api/scanner/ler', verificarToken, async (req, res) => {
    const { token_lido } = req.body;
    const idOrganizador = req.usuario.id; 
    const perfil_organizador = req.usuario.perfil;

    let id_inscricao;
    try {
        id_inscricao = jwt.verify(token_lido, process.env.JWT_SECRET).id_inscricaoAtividade;
    } catch (erro) {
        return res.status(400).json({ status: "erro", mensagem: "QR Code inválido." });
    }

    try {
        
            const queryToken = `
            SELECT ia.id_inscricaoAtividade, u.nome AS nome_participante, u.ra AS ra_participante, 
                   u.fotoUrl, a.data, a.horarioInicio, a.horarioFim, e.id_usuario_gerente, e.id_evento
            FROM InscricaoAtividade ia
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            JOIN Evento e ON a.id_evento = e.id_evento
            JOIN Usuario u ON ia.id_usuario = u.id_usuario
            WHERE ia.id_inscricaoAtividade = ?
        `;
        const [resultados] = await db.execute(queryToken, [id_inscricao]);
        
        if (resultados.length === 0) return res.status(404).json({ status: "erro", mensagem: "Inscrição não encontrada." });
        const info = resultados[0];

        let autorizado = false;
        
        if (perfil_organizador === 'ADMINISTRADOR') {
            autorizado = true; 
        } else if (Number(info.id_usuario_gerente) === Number(id_organizador)) {
            autorizado = true; 
        } else {
            const [staff] = await db.execute('SELECT * FROM EquipeEvento WHERE id_evento = ? AND id_usuario = ?', [info.id_evento, id_organizador]);
            if (staff.length > 0) autorizado = true;
        }

        if (!autorizado) {
            return res.status(403).json({ status: "erro", mensagem: "Você não faz parte da organização deste evento." });
        }


        const TOLERANCIA = 15; 
        const dataAtividadeStr = new Date(info.data).toISOString().split('T')[0];
        const inicioPermitido = new Date(new Date(`${dataAtividadeStr}T${info.horarioInicio}-03:00`).getTime() - (TOLERANCIA * 60 * 1000));
        const fimPermitido = new Date(new Date(`${dataAtividadeStr}T${info.horarioFim}-03:00`).getTime() + (TOLERANCIA * 60 * 1000));
        const agora = new Date();

        if (agora < inicioPermitido) return res.status(400).json({ status: "erro", mensagem: "Check-in ainda não liberado." });
        if (agora > fimPermitido) return res.status(400).json({ status: "erro", mensagem: "Prazo de check-in encerrado." });

        const [presencaExistente] = await db.execute('SELECT id_registroPresenca FROM RegistroPresenca WHERE id_inscricaoAtividade = ?', [info.id_inscricaoAtividade]);
        if (presencaExistente.length > 0) return res.status(400).json({ status: "erro", mensagem: "Este QR Code já foi validado!" });

        res.status(200).json({
            status: "pendente_confirmacao",
            id_inscricaoAtividade: info.id_inscricaoAtividade,
            participante: {
                nome: info.nome_participante,
                documento: info.ra_participante || "N/A",
                foto: info.fotoUrl || "https://res.cloudinary.com/demo/image/upload/d_avatar.png/non_existing_id.png" 
            }
        });

    } catch (erro) {
        res.status(500).json({ status: "erro", mensagem: "Erro interno no servidor." });
    }
});

app.post('/api/scanner/confirmar', verificarToken, async (req, res) => {
    const { id_inscricaoAtividade } = req.body;
    const idOrganizador = req.usuario.id;

    try {
        await db.execute('INSERT INTO RegistroPresenca (id_inscricaoAtividade, idOrganizador) VALUES (?, ?)', 
        [id_inscricaoAtividade, idOrganizador]);
        
        res.status(200).json({ mensagem: "Presença confirmada e salva com sucesso!" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao gravar a presença no banco de dados." });
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
        
        const [ativRes] = await db.execute('SELECT id_evento FROM Atividade WHERE id_atividade = ?', [id_atividade]);
        if (ativRes.length === 0) return res.status(404).json({ erro: "Atividade não encontrada." });

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
                IF(rp.dataHoraLeitura IS NOT NULL, DATE_FORMAT(CONVERT_TZ(rp.dataHoraLeitura, '+00:00', '-03:00'), '%d/%m/%Y %H:%i:%s'), '-') AS HorarioValidacao
            FROM InscricaoAtividade ia
            JOIN Usuario u ON ia.id_usuario = u.id_usuario
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            LEFT JOIN RegistroPresenca rp ON ia.id_inscricaoAtividade = rp.id_inscricaoAtividade
            LEFT JOIN Usuario uo ON rp.idOrganizador = uo.id_usuario
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

// Rota para listar todos os usuários (Apenas Admin)
app.get('/api/admin/usuarios', verificarToken, async (req, res) => {
    if (req.usuario.perfil !== 'ADMINISTRADOR') {
        return res.status(403).json({ erro: "Acesso negado. Apenas administradores podem ver a lista de usuários." });
    }

    try {
        const query = 'SELECT id_usuario, nome, email, cpf, ra, tipoPerfil FROM Usuario ORDER BY nome ASC';
        const [usuarios] = await db.execute(query);
        res.status(200).json(usuarios);
    } catch (erro) {
        console.error("Erro ao buscar usuários:", erro);
        res.status(500).json({ erro: "Erro interno ao carregar a lista de usuários." });
    }
});

// Rota para alterar o perfil de um usuário (Apenas Admin)
app.put('/api/admin/usuarios/:id/perfil', verificarToken, async (req, res) => {
    if (req.usuario.perfil !== 'ADMINISTRADOR') {
        return res.status(403).json({ erro: "Acesso negado. Apenas administradores podem alterar perfis." });
    }

    const { novoPerfil } = req.body;
    const id_alvo = req.params.id;

    if (!['PARTICIPANTE', 'ORGANIZADOR', 'ADMINISTRADOR'].includes(novoPerfil)) {
        return res.status(400).json({ erro: "Perfil inválido." });
    }

    try {
        if (Number(id_alvo) === Number(req.usuario.id) && novoPerfil !== 'ADMINISTRADOR') {
            return res.status(400).json({ erro: "Operação bloqueada: Você não pode remover o seu próprio acesso de Administrador." });
        }

        await db.execute('UPDATE Usuario SET tipoPerfil = ? WHERE id_usuario = ?', [novoPerfil, id_alvo]);
        res.status(200).json({ mensagem: "Perfil atualizado com sucesso!" });
    } catch (erro) {
        console.error("Erro ao atualizar perfil:", erro);
        res.status(500).json({ erro: "Erro interno ao atualizar o perfil do usuário." });
    }
});

const PORT = process.env.DB_PORT;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});