const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require('express-rate-limit');
const { z } = require('zod'); 
const helmet = require('helmet');
const winston = require('winston');

const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

require("dotenv").config();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    message: { erro: "Muitas tentativas de acesso detectadas. Por segurança, aguarde 15 minutos antes de tentar novamente." },
    standardHeaders: true, 
    legacyHeaders: false, 
});

const pagamentoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: { erro: "Muitas tentativas de geração de pagamento. Aguarde alguns minutos para tentar novamente." },
    standardHeaders: true,
    legacyHeaders: false,
});


const apiGeralLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 300, 
    message: { erro: "Muitas requisições ao servidor. Por favor, vá com calma." },
    standardHeaders: true,
    legacyHeaders: false,
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
      // Salva os logs em um arquivo físico no HD da sua VM
      new winston.transports.File({ filename: 'auditoria.log' }),
      // E continua imprimindo no terminal (bom para quando usar ferramentas como PM2)
      new winston.transports.Console({
          format: winston.format.simple(),
      })
  ],
});

const db = require("./db");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});
const payment = new Payment(client);

const app = express();
app.use(express.json({ limit: '50kb' }));

app.use(helmet());

const origensPermitidas = [
    'http://localhost:5173', 
    'https://aki-xjvb.onrender.com',    
    'https://www.aki-xjvb.onrender.com', 
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origensPermitidas.includes(origin)) {
            callback(null, true);
        } else {
            
            callback(new Error('Bloqueado pela política de CORS. Origem não autorizada.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization'],  
    credentials: true
};

app.use(cors(corsOptions));
app.use('/api/', apiGeralLimiter);
app.use(auditoriaLogger);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, 
    },
    fileFilter: (req, file, cb) => {
        
        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        
        if (tiposPermitidos.includes(file.mimetype)) {
            cb(null, true); 
        } else {
            cb(new Error('FORMATO_INVALIDO')); 
        }
    }
});

const validarDados = (schema) => (req, res, next) => {
    try {
        // Verifica se os dados que chegaram batem com a regra definida
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next(); // Tudo certo, pode seguir!
    } catch (err) {
        // Mapeia os erros de forma legível para devolver ao Frontend
        const errosFormatados = err.errors.map(e => e.message).join(', ');
        return res.status(400).json({ 
            erro: "Dados inválidos: " + errosFormatados 
        });
    }
};

const schemaLogin = z.object({
    body: z.object({
        email: z.string().email("Formato de e-mail inválido."),
        senha: z.string().min(1, "A senha é obrigatória.")
    })
});

const schemaCadastro = z.object({
    body: z.object({
        nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
        email: z.string().email("Formato de e-mail inválido."),
        senha: z.string()
            .min(8, "A senha deve ter pelo menos 8 caracteres.")
            .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
            .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
            .regex(/[0-9]/, "A senha deve conter pelo menos um número.")
            .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial (ex: @, #, $, !)."),
        cpf: z.string().regex(/^\d{11}$/, "O CPF deve conter exatamente 11 números, sem pontos ou traços."),
        termos_aceitos: z.literal("true", { errorMap: () => ({ message: "Você precisa aceitar os termos de uso." }) }),
        ra: z.string().optional().nullable(),
        token_google: z.string().optional().nullable()
    })
});

const schemaNovoEvento = z.object({
    body: z.object({
        titulo: z.string().min(5, "O título precisa ter pelo menos 5 caracteres."),
        dataInicio: z.string().min(1, "Data de início é obrigatória."),
        dataFim: z.string().min(1, "Data de fim é obrigatória."),
        idOrganizador: z.string().min(1, "Organizador é obrigatório."),
        descricao: z.string().optional().nullable(),
        local: z.string().optional().nullable(),
        numeroVagas: z.string().optional().nullable(),
        preco: z.string().optional().nullable()
    })
});

const schemaNovoOrganizador = z.object({
    body: z.object({
        nome: z.string().min(3, "O nome é muito curto."),
        email: z.string().email("Formato de e-mail inválido."),
        senha: z.string()
            .min(8, "A senha deve ter pelo menos 8 caracteres.")
            .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
            .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
            .regex(/[0-9]/, "A senha deve conter pelo menos um número.")
            .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial (ex: @, #, $, !)."),
        documento: z.string().optional().nullable()
    })
});

const schemaNovaAtividade = z.object({
    body: z.object({
        id_evento: z.union([z.string(), z.number()], { required_error: "ID do evento é obrigatório." }),
        titulo: z.string().min(3, "O título da atividade precisa ter pelo menos 3 caracteres."),
        tipo: z.string().min(1, "O tipo da atividade é obrigatório."),
        data: z.string().min(10, "Data inválida."),
        horarioInicio: z.string().min(5, "Horário de início inválido."),
        horarioFim: z.string().min(5, "Horário de fim inválido."),
        capacidadeMaxima: z.union([z.string(), z.number()]).optional().nullable()
    })
});

const schemaEditarAtividade = z.object({
    body: z.object({
        titulo: z.string().min(3, "O título da atividade precisa ter pelo menos 3 caracteres."),
        tipo: z.string().min(1, "O tipo da atividade é obrigatório."),
        data: z.string().min(10, "Data inválida."),
        horarioInicio: z.string().min(5, "Horário de início inválido."),
        horarioFim: z.string().min(5, "Horário de fim inválido."),
        capacidadeMaxima: z.union([z.string(), z.number()]).optional().nullable()
    })
});

const schemaEditarPerfil = z.object({
    body: z.object({
        nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
        email: z.string().email("Formato de e-mail inválido."),
        senhaAntiga: z.string().optional(),
        senhaNova: z.string()
            .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
            .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
            .regex(/[0-9]/, "A senha deve conter pelo menos um número.")
            .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial.")
            .optional()
    })
});

const schemaAddEquipe = z.object({
    body: z.object({
        email: z.string().email("Forneça um e-mail válido para convidar o Staff.")
    })
});

const schemaInscricao = z.object({
    body: z.object({
        id_atividade: z.union([z.string(), z.number()], { required_error: "O ID da atividade é obrigatório." })
    })
});

const schemaCheckout = z.object({
    body: z.object({
        id_evento: z.union([z.string(), z.number()], { required_error: "O ID do evento é obrigatório para pagamento." })
    })
});

const schemaScannerLer = z.object({
    body: z.object({
        token_lido: z.string().min(10, "Token inválido ou vazio.")
    })
});

const schemaScannerConfirmar = z.object({
    body: z.object({
        id_inscricaoAtividade: z.union([z.string(), z.number()], { required_error: "O ID da inscrição é obrigatório." })
    })
});

const schemaAlterarPerfil = z.object({
    body: z.object({
        novoPerfil: z.enum(["PARTICIPANTE", "ORGANIZADOR", "ADMINISTRADOR"], { required_error: "Perfil inválido." })
    })
});

const auditoriaLogger = (req, res, next) => {
    res.on('finish', () => {
        if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
            
            const usuarioId = req.usuario ? req.usuario.id : 'ANÔNIMO_OU_FALHA';
            
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            const log = {
                timestamp: new Date().toISOString(),
                nivel: res.statusCode >= 400 ? 'ALERTA_SEGURANCA' : 'AUDITORIA',
                usuario_id: usuarioId,
                metodo: req.method,
                rota: req.originalUrl,
                status_http: res.statusCode,
                ip: ip
            };

            console.log(JSON.stringify(log));
            // logger.info(log); VM
        }
    });
    
    next();
};

const validarMagicBytes = (req, res, next) => {
    
    if (!req.file) return next();

    const buffer = req.file.buffer;
    
    // Pega os 4 primeiros bytes em formato hexadecimal
    const magic = buffer.toString('hex', 0, 4).toUpperCase();
    let isValid = false;

    if (magic.startsWith('FFD8FF')) {
        isValid = true; // É um JPG/JPEG autêntico
    } else if (magic === '89504E47') {
        isValid = true; // É um PNG autêntico
    } else if (magic === '52494646') {
        // Arquivos WebP começam com "RIFF" (52494646), e no byte 8 dizem "WEBP"
        const identificadorWebp = buffer.toString('ascii', 8, 12);
        if (identificadorWebp === 'WEBP') {
            isValid = true; // É um WebP autêntico
        }
    }

    if (!isValid) {
        return res.status(403).json({ 
            erro: "Arquivo malicioso ou formato camuflado detectado. Envie apenas imagens reais (JPG, PNG, WebP)." 
        });
    }

    next();
};

const verificarToken = (req, res, next) => {
  const headerAuth = req.headers["authorization"];
  const token = headerAuth && headerAuth.split(" ")[1];

  if (!token) {
    return res
      .status(403)
      .json({ erro: "Acesso negado. Token não fornecido." });
  }

  try {
    const dadosDecodificados = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.usuario = dadosDecodificados;
    next();
  } catch (erro) {
    return res
      .status(401)
      .json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
  }
};

const verificarDonoOuAdmin = async (
  id_usuario_logado,
  perfil_logado,
  id_evento,
) => {
  if (perfil_logado === "ADMINISTRADOR") return true;

  const [linhas] = await db.execute(
    "SELECT idOrganizador FROM Evento WHERE id_evento = ?",
    [id_evento],
  );

  if (linhas.length === 0) return false;

  return Number(linhas[0].idOrganizador) === Number(id_usuario_logado);
};

app.get('/api/ingresso', verificarToken, async (req, res) => {
    const { id_inscricaoAtividade } = req.query;
    const id_usuario_logado = req.usuario.id;

    if (!id_inscricaoAtividade) {
        return res.status(400).json({ erro: "ID da inscrição não fornecido." });
    }

    try {
        const [inscricoes] = await db.execute(
            'SELECT id_usuario FROM InscricaoAtividade WHERE id_inscricaoAtividade = ?',
            [id_inscricaoAtividade]
        );

        if (inscricoes.length === 0) {
            return res.status(404).json({ erro: "Inscrição não encontrada." });
        }

        if (inscricoes[0].id_usuario !== id_usuario_logado) {
            return res.status(403).json({ erro: "Acesso negado. Esta inscrição não pertence a você." });
        }

        const tokenQrCode = jwt.sign(
            { 
                id_inscricaoAtividade: id_inscricaoAtividade,
                id_usuario: id_usuario_logado,
                typ: 'ingresso_qr', 
                aud: 'scanner_evento'
            },
            process.env.JWT_QR_SECRET, 
            { expiresIn: '15s' } 
        );

        res.status(200).json({ tokenQrCode });

    } catch (erro) {
        console.error("[ERRO_BD] Falha ao gerar QR Code:", erro);
        res.status(500).json({ erro: "Erro interno ao gerar o ingresso." });
    }
});

app.get("/api/status", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT NOW() as data_hora");
    res.json({
      status: "ok",
      mensagem: "API rodando",
      banco_de_dados: rows[0].data_hora,
    });
  } catch (erro) {
    res.status(500).json({ erro: "API no ar, mas banco caiu." });
  }
});

// Rota de cadastro
app.post("/api/cadastro", upload.single("fotoPerfil"), validarMagicBytes, loginLimiter, validarDados(schemaCadastro), async (req, res) => {
  const { nome, email, senha, cpf, ra, termos_aceitos, token_google } = req.body;

  let google_id_verificado = null;

  if (token_google) {
      try {
          const ticket = await googleClient.verifyIdToken({
              idToken: token_google,
              audience: process.env.GOOGLE_CLIENT_ID,
          });
          
          const payload = ticket.getPayload();
          google_id_verificado = payload.sub; 
          
          if (payload.email !== email) {
              return res.status(400).json({ erro: "Fraude bloqueada: O e-mail fornecido não corresponde ao e-mail autorizado da conta Google." });
          }
      } catch (erro) {
          console.error("Erro ao validar token Google no cadastro:", erro);
          return res.status(401).json({ erro: "A assinatura do Google fornecida é inválida ou expirou." });
      }
  }

  try {
    const [usuariosExistentes] = await db.execute(
      "SELECT id_usuario FROM Usuario WHERE email = ?",
      [email],
    );

    if (usuariosExistentes.length > 0) {
      return res.status(409).json({ erro: "Este email já está em uso." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const cpfLimpo = cpf.replace(/\D/g, ""); 

    let fotoUrl = null;

    if (req.file) {
      fotoUrl = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "eventos_perfil",
            format: "jpg",
            transformation: [{ width: 400, height: 400, crop: "fill" }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          },
        );
        uploadStream.end(req.file.buffer);
      });
    }

    const query = `
            INSERT INTO Usuario (nome, email, senha, cpf, ra, tipoPerfil, fotoUrl, termos_aceitos, google_id) 
            VALUES (?, ?, ?, ?, ?, 'PARTICIPANTE', ?, ?, ?)
        `;

    const aceitou = termos_aceitos === "true" ? 1 : 0;
    
    await db.execute(query, [
      nome,
      email,
      senhaHash,
      cpfLimpo,
      ra || null,
      fotoUrl,
      aceitou,
      google_id_verificado || null 
    ]);

    res.status(201).json({ mensagem: "Conta criada com sucesso!" });
  } catch (erro) {
    console.error("Erro no cadastro:", erro);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

// Rota para o participante fazer upload da sua foto
app.post(
  "/api/usuario/foto",
  verificarToken,
  upload.single("fotoPerfil"),
  validarMagicBytes,
  async (req, res) => {
    try {
      const id_usuario = req.usuario.id;

      // Verifica se a foto realmente chegou do Frontend
      if (!req.file) {
        return res.status(400).json({ erro: "Nenhuma foto foi enviada." });
      }

      // ✅ Transmite a imagem da memória RAM direto para o Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "eventos_perfil",
          format: "jpg", // Padroniza o formato para evitar bugs
          transformation: [{ width: 400, height: 400, crop: "fill" }],
        },
        async (error, result) => {
          // Esse bloco só roda quando a nuvem termina de processar a foto
          if (error) {
            console.error("Erro no Cloudinary:", error);
            return res
              .status(500)
              .json({ erro: "Falha ao enviar imagem para a nuvem." });
          }

          const urlImagem = result.secure_url;

          // Salva a URL oficial gerada no banco de dados
          await db.execute(
            "UPDATE Usuario SET fotoUrl = ? WHERE id_usuario = ?",
            [urlImagem, id_usuario],
          );

          return res.status(200).json({
            mensagem: "Foto atualizada com sucesso!",
            fotoUrl: urlImagem,
          });
        },
      );

      // Dispara o arquivo para o Cloudinary iniciar o upload
      uploadStream.end(req.file.buffer);
    } catch (erro) {
      console.error("Erro no upload:", erro);
      res.status(500).json({ erro: "Erro interno ao processar a imagem." });
    }
  },
);

app.post("/api/login", loginLimiter, validarDados(schemaLogin), async (req, res) => {
  const { email, senha } = req.body;

  try {
    const [usuarios] = await db.execute(
      "SELECT * FROM Usuario WHERE email = ?",
      [email],
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
        { id: usuario.id_usuario, perfil: usuario.tipoPerfil, typ: 'access' },
        process.env.JWT_ACCESS_SECRET, 
        { expiresIn: '15m' }    
    );

    const refreshToken = jwt.sign(
        { id: usuario.id_usuario, typ: 'refresh' }, 
        process.env.JWT_REFRESH_SECRET, 
        { expiresIn: '7d' }
    );

    await db.execute(
    'UPDATE Usuario SET token_renovacao = ? WHERE id_usuario = ?', 
    [refreshToken, usuario.id_usuario]
    );

    const [equipe] = await db.execute(
      "SELECT id_evento FROM EquipeEvento WHERE id_usuario = ? LIMIT 1",
      [usuario.id_usuario],
    );
    const isStaff = equipe.length > 0;

    res.status(200).json({
      mensagem: "Login realizado com sucesso!",
      token: tokenSessao,
      refreshToken: refreshToken,
      usuario: {
        id: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.tipoPerfil,
        isStaff: isStaff,
        documento: usuario.cpf || usuario.ra,
        fotoUrl: usuario.fotoUrl || null,
      },
    });
  } catch (erro) {
    console.error("Erro no login:", erro);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

app.post(
  "/api/eventos",
  verificarToken,
  upload.single("imagem"),
  validarMagicBytes,
  validarDados(schemaNovoEvento), 
  async (req, res) => {
    const { titulo, descricao, dataInicio, dataFim, local, numeroVagas, idOrganizador, preco } = req.body;
    const perfil = req.usuario.perfil;

    if (perfil !== "ADMINISTRADOR") {
      return res.status(403).json({
        erro: "Acesso negado. Apenas administradores podem criar eventos.",
      });
    }

    try {
      let url_imagem = null;

      if (req.file) {
        url_imagem = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "capas_eventos", format: "jpg", transformation: [{ width: 800, height: 450, crop: "fill" }] },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            },
          );
          uploadStream.end(req.file.buffer);
        });
      }

      const query = `
            INSERT INTO Evento (id_usuario_gerente, titulo, descricao, dataInicio, dataFim, local, numeroVagas, url_imagem, preco)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
      const [result] = await db.execute(query, [
        idOrganizador,
        titulo,
        descricao || null,
        dataInicio,
        dataFim,
        local || null,
        numeroVagas || null,
        url_imagem,
        preco || 0,
      ]);

      res.status(201).json({
        mensagem: "Evento criado com sucesso!",
        id_evento: result.insertId,
      });
    } catch (erro) {
        console.error("[ERRO_BD] Falha ao salvar evento:", erro);
        const msgErro = erro.sqlMessage || erro.message || "";
        
        if (msgErro.includes('chk_evento_datas')) {
            return res.status(400).json({ erro: "A data de fim não pode ser anterior ao início." });
        }
        if (msgErro.includes('numeroVagas')) {
            return res.status(400).json({ erro: "O número de vagas deve ser maior que zero." });
        }

        res.status(500).json({ erro: "Erro interno do servidor. A equipe técnica já foi notificada." });
    }
  },
);

app.get("/api/organizadores", verificarToken, async (req, res) => {
  if (req.usuario.perfil !== "ADMINISTRADOR")
    return res.status(403).json({ erro: "Acesso negado." });
  try {
    const [organizadores] = await db.execute(
      'SELECT id_usuario, nome, email FROM Usuario WHERE tipoPerfil = "ORGANIZADOR"',
    );
    res.status(200).json(organizadores);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao buscar organizadores." });
  }
});

app.post("/api/eventos/:id/equipe", verificarToken,validarDados(schemaAddEquipe), async (req, res) => {
  const id_evento = req.params.id;
  const { email } = req.body;

  const autorizado = await verificarDonoOuAdmin(
    req.usuario.id,
    req.usuario.perfil,
    id_evento,
  );
  if (!autorizado)
    return res
      .status(403)
      .json({ erro: "Apenas o organizador do evento pode adicionar equipe." });

  try {
    const [usuarios] = await db.execute(
      "SELECT id_usuario, nome FROM Usuario WHERE email = ?",
      [email],
    );
    if (usuarios.length === 0)
      return res.status(404).json({
        erro: "Usuário não encontrado. Peça para a pessoa criar uma conta no sistema primeiro.",
      });

    const id_novo_staff = usuarios[0].id_usuario;

    await db.execute(
      "INSERT IGNORE INTO EquipeEvento (id_evento, id_usuario) VALUES (?, ?)",
      [id_evento, id_novo_staff],
    );

    res.status(200).json({
      mensagem: `${usuarios[0].nome} agora faz parte do Staff do evento!`,
    });
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao adicionar membro à equipe." });
  }
});

app.get("/api/eventos", async (req, res) => {
  try {
    const query = `
      SELECT 
          id_evento, 
          id_usuario_gerente, 
          titulo, 
          descricao, 
          dataInicio, 
          dataFim, 
          local, 
          numeroVagas, 
          url_imagem, 
          preco 
      FROM Evento 
      ORDER BY dataInicio ASC
    `;
    const [eventos] = await db.execute(query);
    
    res.status(200).json(eventos);
  } catch (erro) {
    console.error("Erro ao buscar eventos:", erro);
    res.status(500).json({ erro: "Erro ao carregar a lista de eventos." });
  }
});

app.get("/api/eventos/:id", async (req, res) => {
  try {
    const query = `
            SELECT 
                e.id_evento, 
                e.id_usuario_gerente, 
                e.titulo, 
                e.descricao, 
                e.dataInicio, 
                e.dataFim, 
                e.local, 
                e.numeroVagas, 
                e.url_imagem, 
                e.preco,
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

app.put(
  "/api/eventos/:id",
  verificarToken,
  upload.single("imagem"),
  validarMagicBytes,
  async (req, res) => {
    const {
      titulo,
      descricao,
      dataInicio,
      dataFim,
      local,
      numeroVagas,
      preco,
    } = req.body;
    const { id } = req.params;

    console.log("DADOS RECEBIDOS (PUT):", req.body);

    const autorizado = await verificarDonoOuAdmin(
      req.usuario.id,
      req.usuario.perfil,
      id,
    );
    if (!autorizado) {
      return res.status(403).json({
        erro: "Acesso negado. Você só pode editar eventos que você mesmo criou.",
      });
    }

    if (!titulo || !dataInicio || !dataFim) {
      return res.status(400).json({
        erro: "Título, data de início e data de fim são obrigatórios.",
      });
    }

    try {
      const dataInicioFormatada = dataInicio.replace("T", " ");
      const dataFimFormatada = dataFim.replace("T", " ");

      let url_imagem = null;

      if (req.file) {
        url_imagem = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "capas_eventos",
              format: "jpg",
              transformation: [{ width: 800, height: 450, crop: "fill" }],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            },
          );
          uploadStream.end(req.file.buffer);
        });
      }

      let query;
      let parametros;

      if (url_imagem) {
        query = `
                UPDATE Evento 
                SET titulo = ?, descricao = ?, dataInicio = ?, dataFim = ?, local = ?, numeroVagas = ?, preco = ?, url_imagem = ?
                WHERE id_evento = ?
            `;
        parametros = [
          titulo,
          descricao || null,
          dataInicioFormatada,
          dataFimFormatada,
          local || null,
          numeroVagas || null,
          preco || 0,
          url_imagem,
          id,
        ];
      } else {
        query = `
                UPDATE Evento 
                SET titulo = ?, descricao = ?, dataInicio = ?, dataFim = ?, local = ?, numeroVagas = ?, preco = ?
                WHERE id_evento = ?
            `;
        parametros = [
          titulo,
          descricao || null,
          dataInicioFormatada,
          dataFimFormatada,
          local || null,
          numeroVagas || null,
          preco || 0,
          id,
        ];
      }

      await db.execute(query, parametros);

      res.status(200).json({ mensagem: "Evento atualizado com sucesso!" });
    } catch (erro) {
      console.error("Erro ao atualizar evento:", erro);

      const msgErro = erro.sqlMessage || erro.message || "";
      if (msgErro.includes("chk_evento_datas")) {
        return res.status(400).json({
          erro: "A data e hora de fim do evento não podem ser anteriores ao início.",
        });
      }
      if (msgErro.includes("numeroVagas")) {
        return res
          .status(400)
          .json({ erro: "O número de vagas deve ser maior que zero." });
      }

      res.status(500).json({ erro: "Erro interno do servidor: "});
    }
  },
);

app.post('/api/atividades', verificarToken, validarDados(schemaNovaAtividade), async (req, res) => {
    const { id_evento, titulo, tipo, data, horarioInicio, horarioFim, capacidadeMaxima } = req.body;

    const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id_evento);
    if (!autorizado) {
        return res.status(403).json({ erro: "Acesso negado. Você não é o administrador deste evento." });
    }

    try {
        const query = `
            INSERT INTO Atividade (id_evento, titulo, tipo, data, horarioInicio, horarioFim, capacidadeMaxima)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await db.execute(query, [id_evento, titulo, tipo, data, horarioInicio, horarioFim, capacidadeMaxima || null]);

        res.status(201).json({ mensagem: "Atividade adicionada com sucesso!" });
    } catch (erro) {
        console.error("Erro ao criar atividade:", erro);
        const msgErro = erro.sqlMessage || erro.message || "";
        if (msgErro.includes('chk_atividade_horarios')) return res.status(400).json({ erro: "O horário de término não pode ser anterior ou igual ao início." });
        if (msgErro.includes('capacidadeMaxima')) return res.status(400).json({ erro: "A capacidade deve ser maior que zero." });
        res.status(500).json({ erro: "Erro interno do servidor. "});
    }
});

// Rota para buscar as atividades de um evento COM ESTATÍSTICAS INDIVIDUAIS CORRIGIDAS
app.get("/api/eventos/:id/atividades", async (req, res) => {
  try {
    const id_evento = req.params.id;

    const query = `
            SELECT 
                a.*,
                COUNT(DISTINCT ia.id_inscricaoAtividade) AS vagasOcupadas, 
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

app.put('/api/atividades/:id', verificarToken, validarDados(schemaEditarAtividade), async (req, res) => {
    const { titulo, tipo, data, horarioInicio, horarioFim, capacidadeMaxima } = req.body;
    const { id } = req.params;

    try {
        const [ativRes] = await db.execute('SELECT id_evento FROM Atividade WHERE id_atividade = ?', [id]);
        if (ativRes.length === 0) return res.status(404).json({ erro: "Atividade não encontrada." });

        const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, ativRes[0].id_evento);
        if (!autorizado) return res.status(403).json({ erro: "Acesso negado." });

        const dataFormatada = data.includes('T') ? data.split('T')[0] : data;

        const query = `
            UPDATE Atividade 
            SET titulo = ?, tipo = ?, data = ?, horarioInicio = ?, horarioFim = ?, capacidadeMaxima = ?
            WHERE id_atividade = ?
        `;
        await db.execute(query, [titulo, tipo, dataFormatada, horarioInicio, horarioFim, capacidadeMaxima || null, id]);
        
        res.status(200).json({ mensagem: "Atividade atualizada com sucesso!" });
    } catch (erro) {
        console.error("Erro ao atualizar atividade:", erro);
        const msgErro = erro.sqlMessage || erro.message || "";
        if (msgErro.includes('chk_atividade_horarios')) return res.status(400).json({ erro: "O horário de término não pode ser anterior ao início." });
        if (msgErro.includes('capacidadeMaxima')) return res.status(400).json({ erro: "A capacidade deve ser maior que zero." });
        res.status(500).json({ erro: "Erro interno do servidor." });
    }
});

app.get("/api/atividades", async (req, res) => {
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

app.post('/api/inscricao', verificarToken, validarDados(schemaInscricao), async (req, res) => {
    const { id_atividade } = req.body;
    const id_usuario = req.usuario.id;

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const [atividadeRes] = await conn.execute(
            'SELECT id_evento, capacidadeMaxima, data, horarioFim FROM Atividade WHERE id_atividade = ?', 
            [id_atividade]
        );
        
        if (atividadeRes.length === 0) {
            await conn.rollback(); 
            return res.status(404).json({ erro: "Atividade não encontrada." });
        }

        const { id_evento, capacidadeMaxima, data, horarioFim } = atividadeRes[0];

        const [ingressoRes] = await conn.execute(
            'SELECT status_pagamento FROM InscricaoEvento WHERE id_usuario = ? AND id_evento = ?',
            [id_usuario, id_evento]
        );

        if (ingressoRes.length === 0 || ingressoRes[0].status_pagamento !== 'PAGO') {
            await conn.rollback();
            return res.status(403).json({ 
                erro: "Acesso bloqueado! Você precisa confirmar a inscrição/pagamento do Evento antes de escolher as atividades." 
            });
        }

        const dataFormatada = new Date(data).toISOString().split('T')[0];
        const dataHoraFimAtividade = new Date(`${dataFormatada}T${horarioFim}-03:00`); 
        const agora = new Date();

        if (agora > dataHoraFimAtividade) {
            await conn.rollback();
            return res.status(400).json({ 
                erro: "Inscrição recusada! Esta atividade já foi encerrada e não aceita novos participantes." 
            });
        }

        const [inscricaoExistente] = await conn.execute(
            'SELECT id_inscricaoAtividade FROM InscricaoAtividade WHERE id_usuario = ? AND id_atividade = ?', 
            [id_usuario, id_atividade]
        );
        
        if (inscricaoExistente.length > 0) {
            await conn.rollback();
            return res.status(400).json({ erro: "Você já realizou a sua inscrição nesta atividade." });
        }

        if (capacidadeMaxima && capacidadeMaxima > 0) {
            const queryInscricao = `
                INSERT INTO InscricaoAtividade (id_usuario, id_atividade)
                SELECT ?, ? FROM DUAL
                WHERE (
                    SELECT COUNT(*) FROM (SELECT 1 FROM InscricaoAtividade WHERE id_atividade = ?) AS temp
                ) < ?
            `;
            const [resultado] = await conn.execute(queryInscricao, [id_usuario, id_atividade, id_atividade, capacidadeMaxima]);
            
            if (resultado.affectedRows === 0) {
                await conn.rollback();
                return res.status(403).json({ erro: "Lotação esgotada! Não há mais vagas para esta atividade." });
            }
        } else {
            await conn.execute('INSERT INTO InscricaoAtividade (id_usuario, id_atividade) VALUES (?, ?)', [id_usuario, id_atividade]);
        }
        
        await conn.commit();
        res.status(201).json({ mensagem: "Inscrição realizada com sucesso! O QR Code já está no seu Dashboard." });

    } catch (erro) {
        if (conn && !conn.connection._isCommitted && !conn.connection._isReleased) {
            await conn.rollback();
        }
        console.error("Erro ao processar inscrição:", erro);
        res.status(500).json({ erro: "Erro interno ao processar a inscrição." });
    } finally {
        if (conn && conn.release) conn.release();
    }
});

app.get("/api/meus-ingressos", verificarToken, async (req, res) => {
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

    const ingressosFormatados = ingressos.map((ing) => ({
      ...ing,
      checkinRealizado: ing.checkinRealizado === 1,
    }));

    res.status(200).json(ingressosFormatados);
  } catch (erro) {
    console.error("Erro ao buscar ingressos:", erro);
    res.status(500).json({ erro: "Erro ao carregar a lista de ingressos." });
  }
});

app.post("/api/scanner/ler", verificarToken, validarDados(schemaScannerLer), async (req, res) => {
  const { token_lido } = req.body;
  const id_organizador = req.usuario.id;
  const perfil_organizador = req.usuario.perfil;

  let decodificado;
  try {
      decodificado = jwt.verify(token_lido, process.env.JWT_QR_SECRET, {
          audience: 'scanner_evento' 
      });
      
      if (decodificado.typ !== 'ingresso_qr') {
          throw new Error("Token fora do propósito");
      }

  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
        return res.status(401).json({ status: "erro", mensagem: "QR Code expirado (passou de 15s). Peça ao aluno para atualizar a tela." });
    }
    return res.status(400).json({ status: "erro", mensagem: "QR Code inválido ou corrompido." });
  }

  const id_inscricao = decodificado.id_inscricaoAtividade;
  const id_usuario_qr = decodificado.id_usuario; 

  try {
    const queryToken = `
            SELECT ia.id_inscricaoAtividade, u.nome AS nome_participante, u.ra AS ra_participante, u.cpf AS cpf_participante,
                   u.fotoUrl, a.data, a.horarioInicio, a.horarioFim, e.id_usuario_gerente, e.id_evento
            FROM InscricaoAtividade ia
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            JOIN Evento e ON a.id_evento = e.id_evento
            JOIN Usuario u ON ia.id_usuario = u.id_usuario
            WHERE ia.id_inscricaoAtividade = ? AND ia.id_usuario = ?
        `;
    const [resultados] = await db.execute(queryToken, [id_inscricao, id_usuario_qr]);

    if (resultados.length === 0)
      return res.status(404).json({ status: "erro", mensagem: "Ingresso inválido, falsificado ou não pertence a este aluno." });
      
    const info = resultados[0];

    let autorizado = false;

    if (perfil_organizador === "ADMINISTRADOR") {
      autorizado = true;
    } else if (Number(info.id_usuario_gerente) === Number(id_organizador)) { 
      autorizado = true;
    } else {
      const [staff] = await db.execute(
        "SELECT * FROM EquipeEvento WHERE id_evento = ? AND id_usuario = ?",
        [info.id_evento, id_organizador], 
      );
      if (staff.length > 0) autorizado = true;
    }

    if (!autorizado) {
      return res.status(403).json({
        status: "erro",
        mensagem: "Você não faz parte da organização ou do Staff deste evento.",
      });
    }

    const TOLERANCIA = 15;
    const dataAtividadeStr = new Date(info.data).toISOString().split("T")[0];
    const inicioPermitido = new Date(
      new Date(`${dataAtividadeStr}T${info.horarioInicio}-03:00`).getTime() - TOLERANCIA * 60 * 1000,
    );
    const fimPermitido = new Date(
      new Date(`${dataAtividadeStr}T${info.horarioFim}-03:00`).getTime() + TOLERANCIA * 60 * 1000,
    );
    const agora = new Date();

    if (agora < inicioPermitido)
      return res.status(400).json({ status: "erro", mensagem: "Check-in ainda não está liberado para esta atividade." });
    if (agora > fimPermitido)
      return res.status(400).json({ status: "erro", mensagem: "O prazo para realizar o check-in nesta atividade já foi encerrado." });

    const [presencaExistente] = await db.execute(
      "SELECT id_registroPresenca FROM RegistroPresenca WHERE id_inscricaoAtividade = ?",
      [info.id_inscricaoAtividade],
    );
    
    if (presencaExistente.length > 0)
      return res.status(400).json({ status: "erro", mensagem: "Este ingresso já foi validado anteriormente!" });

    res.status(200).json({
      status: "pendente_confirmacao",
      id_inscricaoAtividade: info.id_inscricaoAtividade,
      participante: {
        nome: info.nome_participante,
        documento: info.ra_participante || info.cpf_participante || "Não informado",
        foto: info.fotoUrl || "https://res.cloudinary.com/demo/image/upload/d_avatar.png/non_existing_id.png",
      },
    });
    
  } catch (erro) {
    console.error("[ERRO_BD] Falha ao processar leitura do QR:", erro);
    res.status(500).json({ status: "erro", mensagem: "Erro interno no servidor ao validar QR Code." });
  }
});

app.post('/api/scanner/confirmar', verificarToken, validarDados(schemaScannerConfirmar), async (req, res) => {
    const { id_inscricaoAtividade } = req.body;
    
    const id_organizador = req.usuario.id;
    const perfil_organizador = req.usuario.perfil;

    try {
        
        const queryInfo = `
            SELECT e.id_evento, e.id_usuario_gerente
            FROM InscricaoAtividade ia
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            JOIN Evento e ON a.id_evento = e.id_evento
            WHERE ia.id_inscricaoAtividade = ?
        `;
        const [infoRes] = await db.execute(queryInfo, [id_inscricaoAtividade]);

        
        if (infoRes.length === 0) {
            return res.status(404).json({ erro: "Inscrição não encontrada." });
        }

        const info = infoRes[0];
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
            return res.status(403).json({ erro: "Fraude bloqueada: Você não tem permissão para validar check-ins neste evento." });
        }

        await db.execute('INSERT INTO RegistroPresenca (id_inscricaoAtividade, id_organizador) VALUES (?, ?)', 
        [id_inscricaoAtividade, id_organizador]);
        
        res.status(200).json({ mensagem: "Presença confirmada e salva com sucesso!" });
        
    } catch (erro) {
        console.error("Erro na confirmação de presença:", erro);
        
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ erro: "Este check-in já foi confirmado anteriormente." });
        }
        
        res.status(500).json({ erro: "Erro ao gravar a presença no banco de dados." });
    }
});

// ==========================================
// 1. CANCELAR INSCRIÇÃO EM ATIVIDADE
// ==========================================
app.delete("/api/inscricao/:id_inscricao", verificarToken, async (req, res) => {
  const id_usuario = req.usuario.id;
  const { id_inscricao } = req.params;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [presencas] = await conn.execute(
      "SELECT id_registroPresenca FROM RegistroPresenca WHERE id_inscricaoAtividade = ? FOR UPDATE",
      [id_inscricao]
    );
    
    if (presencas.length > 0) {
      await conn.rollback();
      return res.status(400).json({
        erro: "Cancelamento bloqueado: Seu check-in já foi confirmado.",
      });
    }

    const [resultado] = await conn.execute(
      "DELETE FROM InscricaoAtividade WHERE id_inscricaoAtividade = ? AND id_usuario = ?",
      [id_inscricao, id_usuario]
    );

    if (resultado.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ erro: "Inscrição não encontrada ou não pertence a você." });
    }

    await conn.commit();
    res.status(200).json({ mensagem: "Inscrição cancelada com sucesso. Vaga liberada!" });
    
  } catch (erro) {
    await conn.rollback();
    console.error("Erro transacional ao cancelar inscrição:", erro);
    res.status(500).json({ erro: "Erro interno ao cancelar inscrição." });
  } finally {
    if (conn) conn.release();
  }
});


// ==========================================
// 2. EXCLUIR ATIVIDADE ESPECÍFICA
// ==========================================
app.delete("/api/atividades/:id", verificarToken, async (req, res) => {
  const id_atividade = req.params.id;

  try {
    const [ativRes] = await db.execute(
      "SELECT id_evento FROM Atividade WHERE id_atividade = ?",
      [id_atividade]
    );
    if (ativRes.length === 0) {
      return res.status(404).json({ erro: "Atividade não encontrada." });
    }

    const autorizado = await verificarDonoOuAdmin(
      req.usuario.id,
      req.usuario.perfil,
      ativRes[0].id_evento
    );
    if (!autorizado) {
      return res.status(403).json({ erro: "Acesso negado. Você não é o administrador deste evento." });
    }
  } catch (erro) {
    return res.status(500).json({ erro: "Erro ao validar permissões da atividade." });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      "DELETE rp FROM RegistroPresenca rp JOIN InscricaoAtividade ia ON rp.id_inscricaoAtividade = ia.id_inscricaoAtividade WHERE ia.id_atividade = ?",
      [id_atividade]
    );
    await conn.execute("DELETE FROM InscricaoAtividade WHERE id_atividade = ?", [id_atividade]);
    await conn.execute("DELETE FROM Atividade WHERE id_atividade = ?", [id_atividade]);

    await conn.commit();
    res.status(200).json({ mensagem: "Atividade e todas as inscrições nela vinculadas foram excluídas." });
    
  } catch (erro) {
    await conn.rollback();
    console.error("Erro transacional ao excluir atividade:", erro);
    res.status(500).json({ erro: "Erro ao excluir a atividade." });
  } finally {
    if (conn) conn.release();
  }
});

// ==========================================
// 3. EXCLUIR EVENTO COMPLETO
// ==========================================
app.delete("/api/eventos/:id", verificarToken, async (req, res) => {
  const id_evento = req.params.id;

  try {
    const autorizado = await verificarDonoOuAdmin(
      req.usuario.id,
      req.usuario.perfil,
      id_evento
    );
    if (!autorizado) {
      return res.status(403).json({ erro: "Acesso negado. Você só pode excluir eventos que você mesmo criou." });
    }
  } catch (erro) {
    return res.status(500).json({ erro: "Erro ao validar permissões do evento." });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute("DELETE FROM EquipeEvento WHERE id_evento = ?", [id_evento]);
    await conn.execute("DELETE FROM InscricaoEvento WHERE id_evento = ?", [id_evento]);

    await conn.execute(
      "DELETE rp FROM RegistroPresenca rp JOIN InscricaoAtividade ia ON rp.id_inscricaoAtividade = ia.id_inscricaoAtividade JOIN Atividade a ON ia.id_atividade = a.id_atividade WHERE a.id_evento = ?",
      [id_evento]
    );
    await conn.execute(
      "DELETE ia FROM InscricaoAtividade ia JOIN Atividade a ON ia.id_atividade = a.id_atividade WHERE a.id_evento = ?",
      [id_evento]
    );
    await conn.execute("DELETE FROM Atividade WHERE id_evento = ?", [id_evento]);
    
    await conn.execute("DELETE FROM Evento WHERE id_evento = ?", [id_evento]);

    await conn.commit();
    res.status(200).json({ mensagem: "O evento foi completamente OBLITERADO e excluído do sistema." });
    
  } catch (erro) {
    await conn.rollback();
    console.error("Erro transacional ao excluir evento:", erro);
    res.status(500).json({ erro: "Erro crítico ao tentar excluir o evento." });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/api/eventos/:id/relatorio", verificarToken, async (req, res) => {
  const { id } = req.params;

  const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id);
  if (!autorizado) {
    return res.status(403).json({ erro: "Acesso negado. Você não tem permissão para extrair relatórios." });
  }

  try {
    const query = `
            SELECT 
                u.nome AS Participante,
                u.email AS Email,
                IFNULL(NULLIF(u.cpf, ''), 'N/I') AS CPF,
                IFNULL(NULLIF(u.ra, ''), 'N/I') AS RA,
                a.titulo AS Atividade,
                IFNULL(a.tipo, 'Não Informado') AS TipoAtividade,
                DATE_FORMAT(a.data, '%d/%m/%Y') AS Data,
                a.horarioInicio AS Inicio,
                a.horarioFim AS Fim,
                ROUND(TIME_TO_SEC(TIMEDIFF(a.horarioFim, a.horarioInicio)) / 3600, 1) AS CargaHoraria,
                IF(rp.id_registroPresenca IS NOT NULL, 'Presente', 'Ausente') AS Status,
                COALESCE(uo.nome, '-') AS ValidadoPor,
                IF(rp.dataHoraLeitura IS NOT NULL, DATE_FORMAT(CONVERT_TZ(rp.dataHoraLeitura, '+00:00', '-03:00'), '%d/%m/%Y %H:%i:%s'), '-') AS HorarioValidacao,
                CONCAT(
                    ROUND(
                        IFNULL(
                            (SELECT SUM(TIME_TO_SEC(TIMEDIFF(a2.horarioFim, a2.horarioInicio)))
                             FROM InscricaoAtividade ia2 
                             JOIN Atividade a2 ON ia2.id_atividade = a2.id_atividade 
                             JOIN RegistroPresenca rp2 ON ia2.id_inscricaoAtividade = rp2.id_inscricaoAtividade 
                             WHERE ia2.id_usuario = u.id_usuario AND a2.id_evento = ?), 0
                        ) 
                        / 
                        NULLIF((SELECT SUM(TIME_TO_SEC(TIMEDIFF(a3.horarioFim, a3.horarioInicio)))
                         FROM Atividade a3 
                         WHERE a3.id_evento = ?), 0) * 100
                    , 1), 
                '%') AS FrequenciaGlobal
            FROM InscricaoAtividade ia
            JOIN Usuario u ON ia.id_usuario = u.id_usuario
            JOIN Atividade a ON ia.id_atividade = a.id_atividade
            LEFT JOIN RegistroPresenca rp ON ia.id_inscricaoAtividade = rp.id_inscricaoAtividade
            LEFT JOIN Usuario uo ON rp.id_organizador = uo.id_usuario 
            WHERE a.id_evento = ?
            ORDER BY u.nome ASC, a.data ASC, a.horarioInicio ASC
        `;

    const [relatorio] = await db.execute(query, [id, id, id]);
    res.status(200).json(relatorio);
  } catch (erro) {
    console.error("Erro ao gerar relatório:", erro);
    res.status(500).json({ erro: "Erro ao exportar os dados do evento." });
  }
});

app.post("/api/admin/organizadores", verificarToken, validarDados(schemaNovoOrganizador), async (req, res) => {
  if (req.usuario.perfil !== "ADMINISTRADOR") {
    return res.status(403).json({
      erro: "Acesso negado. Apenas administradores podem cadastrar organizadores.",
    });
  }

  const { nome, email, senha, documento } = req.body;

  try {
    const [usuariosExistentes] = await db.execute(
      "SELECT id_usuario FROM Usuario WHERE email = ?",
      [email],
    );
    if (usuariosExistentes.length > 0) {
      return res.status(409).json({ erro: "Este email já está em uso." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    let cpf = null;
    let ra = null;

    if (documento) {
      const documentoLimpo = documento.replace(/\D/g, "");
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
app.get("/api/eventos/:id/estatisticas", verificarToken, async (req, res) => {
  const id_evento = req.params.id;

  try {
      const autorizado = await verificarDonoOuAdmin(req.usuario.id, req.usuario.perfil, id_evento);
      if (!autorizado) {
          return res.status(403).json({ erro: "Acesso negado. Apenas o organizador do evento pode visualizar as estatísticas de negócio." });
      }
  } catch (erro) {
      return res.status(500).json({ erro: "Erro ao validar permissões de acesso às estatísticas." });
  }

  try {
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
    const numeroVagas = resEvento?.numeroVagas || 0; 

    const taxaComparecimento =
      inscritos > 0 ? Math.round((checkins / inscritos) * 100) : 0;

    let taxaOcupacao = null;
    if (numeroVagas > 0) {
      taxaOcupacao = Math.round((inscritos / numeroVagas) * 100);
    }

    res.status(200).json({
      totalInscritos: inscritos,
      totalCheckins: checkins,
      taxaComparecimento: taxaComparecimento,
      numeroVagas: numeroVagas,
      taxaOcupacao: taxaOcupacao,
    });
  } catch (erro) {
    console.error("Erro ao gerar estatísticas do evento:", erro);
    res.status(500).json({ erro: "Erro ao carregar métricas do painel." });
  }
});

app.get("/api/admin/usuarios", verificarToken, async (req, res) => {
  if (req.usuario.perfil !== "ADMINISTRADOR") {
    return res.status(403).json({
      erro: "Acesso negado. Apenas administradores podem ver a lista de usuários.",
    });
  }

  try {
    const query = "SELECT id_usuario, nome, email, cpf, ra, tipoPerfil FROM Usuario ORDER BY nome ASC";
    const [usuarios] = await db.execute(query);

    const usuariosMascarados = usuarios.map(u => ({
        id_usuario: u.id_usuario,
        nome: u.nome,
        email: u.email,
        tipoPerfil: u.tipoPerfil,
        cpf: u.cpf ? `***.***.***-${u.cpf.slice(-2)}` : null,
        ra: u.ra ? `***${u.ra.slice(-3)}` : null
    }));

    res.status(200).json(usuariosMascarados);
    
  } catch (erro) {
    console.error("Erro ao buscar usuários:", erro);
    res.status(500).json({ erro: "Erro interno ao carregar a lista de usuários." });
  }
});

// Rota para alterar o perfil de um usuário (Apenas Admin)
app.put("/api/admin/usuarios/:id/perfil", verificarToken, validarDados(schemaAlterarPerfil), async (req, res) => {
  if (req.usuario.perfil !== "ADMINISTRADOR") {
    return res.status(403).json({
      erro: "Acesso negado. Apenas administradores podem alterar perfis.",
    });
  } 

  const { novoPerfil } = req.body;
  const id_alvo = req.params.id;

  try {
    if (
      Number(id_alvo) === Number(req.usuario.id) &&
      novoPerfil !== "ADMINISTRADOR"
    ) {
      return res.status(400).json({
        erro: "Operação bloqueada: Você não pode remover o seu próprio acesso de Administrador.",
      });
    }

    await db.execute("UPDATE Usuario SET tipoPerfil = ? WHERE id_usuario = ?", [
      novoPerfil,
      id_alvo,
    ]);
    res.status(200).json({ mensagem: "Perfil atualizado com sucesso!" });
  } catch (erro) {
    console.error("Erro ao atualizar perfil:", erro);
    res
      .status(500)
      .json({ erro: "Erro interno ao atualizar o perfil do usuário." });
  }
});

// ==========================================
// ROTA DE PAGAMENTO PIX (MERCADO PAGO)
// ==========================================

// ==========================================
// ROTA 1: BUSCAR STATUS (Agora Limpa, sem recuperar PIX)
// ==========================================
app.get(
  "/api/eventos/:id/status-pagamento",
  verificarToken,
  async (req, res) => {
    try {
      const [inscricao] = await db.execute(
        "SELECT status_pagamento FROM InscricaoEvento WHERE id_usuario = ? AND id_evento = ?",
        [req.usuario.id, req.params.id],
      );

      if (inscricao.length > 0) {
        res.status(200).json({ status: inscricao[0].status_pagamento });
      } else {
        res.status(200).json({ status: null });
      }
    } catch (erro) {
      console.error("Erro ao buscar status de pagamento:", erro);
      res.status(500).json({ erro: "Erro ao buscar status." });
    }
  },
);

// ==========================================
// CRIAR CHECKOUT PRO 
// ==========================================
app.post('/api/pagamentos/checkout-pro', verificarToken, pagamentoLimiter, validarDados(schemaCheckout), async (req, res) => {
    const { id_evento } = req.body;
    const id_usuario = req.usuario.id;

    if (!id_evento) return res.status(400).json({ erro: "ID do evento é obrigatório." });

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 1. FOR UPDATE removido
        const [eventos] = await conn.execute(
            'SELECT titulo, preco, numeroVagas FROM Evento WHERE id_evento = ?', 
            [id_evento]
        );
        
        if (eventos.length === 0) {
            await conn.rollback();
            return res.status(404).json({ erro: "Evento não encontrado." });
        }
        
        const evento = eventos[0];
        const preco = Number(evento.preco);
        const numeroVagas = evento.numeroVagas;

        const [inscricaoExiste] = await conn.execute(
            'SELECT status_pagamento FROM InscricaoEvento WHERE id_usuario = ? AND id_evento = ?',
            [id_usuario, id_evento]
        );

        if (inscricaoExiste.length > 0 && inscricaoExiste[0].status_pagamento === 'PAGO') {
            await conn.rollback();
            return res.status(400).json({ erro: "Você já está inscrito neste evento!" });
        }

        if (preco === 0) {
            if (inscricaoExiste.length === 0) {
                const queryGratis = `
                    INSERT INTO InscricaoEvento (id_usuario, id_evento, valor_pago, status_pagamento)
                    SELECT ?, ?, 0.00, 'PAGO' FROM DUAL
                    WHERE (? IS NULL OR ? = 0 OR (SELECT COUNT(*) FROM (SELECT 1 FROM InscricaoEvento WHERE id_evento = ?) AS temp) < ?)
                `;
                const [resultado] = await conn.execute(queryGratis, [id_usuario, id_evento, numeroVagas, numeroVagas, id_evento, numeroVagas]);
                
                if (numeroVagas > 0 && resultado.affectedRows === 0) {
                    await conn.rollback();
                    return res.status(403).json({ erro: "Lotação esgotada! Os ingressos para este evento acabaram." });
                }
            } else {
                await conn.execute('UPDATE InscricaoEvento SET status_pagamento = ? WHERE id_usuario = ? AND id_evento = ?', ['PAGO', id_usuario, id_evento]);
            }
            
            await conn.commit();
            return res.status(200).json({ status: 'gratis', mensagem: "Inscrição gratuita realizada com sucesso!" });
        }

        if (inscricaoExiste.length === 0) {
            const queryPago = `
                INSERT INTO InscricaoEvento (id_usuario, id_evento, valor_pago, status_pagamento)
                SELECT ?, ?, ?, 'PENDENTE' FROM DUAL
                WHERE (? IS NULL OR ? = 0 OR (SELECT COUNT(*) FROM (SELECT 1 FROM InscricaoEvento WHERE id_evento = ?) AS temp) < ?)
            `;
            const [resultado] = await conn.execute(queryPago, [id_usuario, id_evento, preco, numeroVagas, numeroVagas, id_evento, numeroVagas]);
            
            if (numeroVagas > 0 && resultado.affectedRows === 0) {
                await conn.rollback();
                return res.status(403).json({ erro: "Lotação esgotada! Os ingressos para este evento acabaram." });
            }
        }
        
        await conn.commit();

        const [usuarios] = await db.execute('SELECT nome, email FROM Usuario WHERE id_usuario = ?', [id_usuario]);
        const usuario = usuarios[0];

        const preference = new Preference(client);
        const respostaMP = await preference.create({
            body: {
                items: [
                    {
                        id: String(id_evento),
                        title: `Inscrição: ${evento.titulo}`,
                        quantity: 1,
                        unit_price: preco,
                        currency_id: 'BRL'
                    }
                ],
                payer: {
                    name: usuario.nome.split(' ')[0],
                    email: usuario.email
                },
                back_urls: {
                    success: `https://aki-xjvb.onrender.com/eventos/${id_evento}`,
                    failure: `https://aki-xjvb.onrender.com/eventos/${id_evento}`,
                    pending: `https://aki-xjvb.onrender.com/eventos/${id_evento}`
                },
                auto_return: 'approved',
                external_reference: `USUARIO_${id_usuario}_EVENTO_${id_evento}`,
                notification_url: 'https://gerenciadordeeventos.onrender.com/api/pagamentos/webhook'
            }
        });

        res.status(200).json({ status: 'pendente', link_pagamento: respostaMP.init_point });

    } catch (erro) {
        if (conn && !conn.connection._isCommitted && !conn.connection._isReleased) {
            await conn.rollback();
        }
        console.error("Erro ao gerar link de pagamento:", erro);
        res.status(500).json({ erro: "Erro interno ao gerar o pagamento." });
    } finally {
        if (conn && conn.release) conn.release();
    }
});

// ==========================================
// ROTA 3: WEBHOOK 
// ==========================================

app.post("/api/pagamentos/webhook", async (req, res) => {
  const action = req.body.action || req.body.type;
  const paymentId = req.body?.data?.id || req.query.id;

  try {
    if (
      action === "payment.created" ||
      action === "payment.updated" ||
      req.query.topic === "payment"
    ) {
      const statusOficial = await payment.get({ id: paymentId });

      if (statusOficial.status === "approved") {
        const referencia = statusOficial.external_reference; 

        if (referencia && referencia.startsWith("USUARIO_")) {
          const partes = referencia.split("_");
          const id_usuario = partes[1];
          const id_evento = partes[3];

          const [inscricaoAtual] = await db.execute(
              "SELECT status_pagamento FROM InscricaoEvento WHERE id_usuario = ? AND id_evento = ?",
              [id_usuario, id_evento]
          );

          if (inscricaoAtual.length > 0 && inscricaoAtual[0].status_pagamento !== "PAGO") {
              const query = "UPDATE InscricaoEvento SET status_pagamento = ?, id_transacao_mp = ? WHERE id_usuario = ? AND id_evento = ?";
              await db.execute(query, ["PAGO", paymentId, id_usuario, id_evento]);

              console.log(`SUCESSO: Aluno ${id_usuario} pagou o Evento ${id_evento} via MP! Vaga liberada.`);
              
          } else {
              console.log(`Webhook ignorado: O pagamento do aluno ${id_usuario} para o evento ${id_evento} já havia sido processado.`);
          }
        }
      }
    }
    res.status(200).send("Notificação recebida.");
  } catch (erro) {
    console.error("Erro ao processar o Webhook:", erro);
    res.status(500).send("Erro interno");
  }
});

// ==========================================
// ROTAS DE PERFIL DO USUÁRIO
// ==========================================

// Buscar os dados atuais do usuário logado
app.get("/api/usuario/perfil", verificarToken, async (req, res) => {
  try {
    const [usuarios] = await db.execute(
      "SELECT nome, email, cpf, ra, fotoUrl FROM Usuario WHERE id_usuario = ?",
      [req.usuario.id],
    );

    if (usuarios.length === 0)
      return res.status(404).json({ erro: "Usuário não encontrado." });

    res.status(200).json(usuarios[0]);
  } catch (erro) {
    console.error("Erro ao buscar perfil:", erro);
    res.status(500).json({ erro: "Erro interno ao buscar dados do perfil." });
  }
});

// Atualizar os dados e/ou a foto
app.put('/api/usuario/perfil', verificarToken, upload.single('fotoPerfil'), validarMagicBytes,validarDados(schemaEditarPerfil), async (req, res) => {
    
    const { nome, email, senhaAntiga, senhaNova } = req.body;
    const id_usuario = req.usuario.id;

    if (!nome || !email) {
        return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
    }

    try {
        
        const [emailExiste] = await db.execute(
            'SELECT id_usuario FROM Usuario WHERE email = ? AND id_usuario != ?',
            [email, id_usuario]
        );
        if (emailExiste.length > 0) return res.status(400).json({ erro: "Este e-mail já está em uso por outra conta." });

        let senhaHashNova = null;
        
        if (senhaNova) {
            
            if (!senhaAntiga) {
                return res.status(400).json({ erro: "Para alterar a senha, você deve informar a sua senha atual de segurança." });
            }

            const [usuarios] = await db.execute('SELECT senha FROM Usuario WHERE id_usuario = ?', [id_usuario]);
            
            if (usuarios.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });

            const senhaValida = await bcrypt.compare(senhaAntiga, usuarios[0].senha);
            
            if (!senhaValida) {
                return res.status(401).json({ erro: "A senha atual está incorreta. Acesso negado." });
            }

            senhaHashNova = await bcrypt.hash(senhaNova, 10);
        }

        let url_imagem = null;

        if (req.file) {
            url_imagem = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'eventos_perfil', format: 'jpg', transformation: [{ width: 400, height: 400, crop: 'fill' }] },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
        }

        let query = 'UPDATE Usuario SET nome = ?, email = ?';
        const parametros = [nome, email];

        if (senhaHashNova) {
            query += ', senha = ?';
            parametros.push(senhaHashNova);
        }

        if (url_imagem) {
            query += ', fotoUrl = ?';
            parametros.push(url_imagem);
        }

        query += ' WHERE id_usuario = ?';
        parametros.push(id_usuario);

        await db.execute(query, parametros);

        res.status(200).json({ 
            mensagem: "Perfil atualizado com sucesso!",
            fotoUrl: url_imagem 
        });

    } catch (erro) {
        console.error("[ERRO_BD] Falha ao atualizar perfil:", erro);
        res.status(500).json({ erro: "Erro interno ao processar a atualização do perfil." });
    }
});

app.post('/api/auth/google', loginLimiter, async (req, res) => {
    const { token_google } = req.body;

    if (!token_google) {
        return res.status(400).json({ erro: "Token do Google não fornecido." });
    }

    try {
        
        const ticket = await googleClient.verifyIdToken({
            idToken: token_google,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        
        const { email, name, sub: google_id, email_verified } = payload; 

        if (!email_verified) {
            return res.status(403).json({ erro: "Acesso negado. O e-mail desta conta Google não possui verificação confirmada." });
        }

        const [usuarios] = await db.execute('SELECT * FROM Usuario WHERE email = ?', [email]);

        if (usuarios.length > 0) {
            // CENÁRIO 1: Usuário já existe!
            const usuario = usuarios[0];

            if (!usuario.google_id) {
                // Se a conta local existe (feita por senha), mas nunca logou com o Google,
                await db.execute('UPDATE Usuario SET google_id = ? WHERE id_usuario = ?', [google_id, usuario.id_usuario]);
            } else if (usuario.google_id !== google_id) {
                // Se o e-mail bate, mas o ID do Google armazenado é diferente do atual, é uma tentativa de colisão.
                return res.status(403).json({ erro: "Conflito de credenciais detectado. Por favor, faça login utilizando sua senha." });
            }

            const tokenSessao = jwt.sign(
                { id: usuario.id_usuario, perfil: usuario.tipoPerfil },
                process.env.JWT_ACCESS_SECRET, 
                { expiresIn: '15m' }    
            );

            const refreshToken = jwt.sign(
                { id: usuario.id_usuario }, 
                process.env.JWT_REFRESH_SECRET, 
                { expiresIn: '7d' }
            );

            await db.execute(
              'UPDATE Usuario SET token_renovacao = ? WHERE id_usuario = ?', 
              [refreshToken, usuario.id_usuario]
          );

            const [equipe] = await db.execute('SELECT id_evento FROM EquipeEvento WHERE id_usuario = ? LIMIT 1', [usuario.id_usuario]);
            const isStaff = equipe.length > 0;

            return res.status(200).json({
                acao: "login",
                mensagem: "Login realizado com sucesso via Google!",
                token: tokenSessao,
                refreshToken: refreshToken,
                usuario: {
                    id: usuario.id_usuario,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfil: usuario.tipoPerfil,
                    isStaff: isStaff,
                    documento: usuario.cpf || usuario.ra,
                    fotoUrl: usuario.fotoUrl || null
                }
            });
        } else {
            // CENÁRIO 2: Usuário não existe. 
            return res.status(202).json({
                acao: "completar_cadastro",
                mensagem: "Finalize seu cadastro adicionando seus documentos e sua foto.",
                dados_sugeridos: { nome: name, email: email, google_id: google_id }
            });
        }

    } catch (erro) {
        console.error("Erro na validação do Google:", erro);
        res.status(401).json({ erro: "Assinatura do Google inválida ou expirada." });
    }
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ erro: "O arquivo é muito grande! O tamanho máximo permitido é de 5MB." });
        }
    } else if (err.message === 'FORMATO_INVALIDO') {
        return res.status(400).json({ erro: "Formato de arquivo não suportado. Envie apenas imagens JPG, PNG ou WEBP." });
    }
    
    next(err);
});

// ==========================================
// ROTA DE REFRESH TOKEN
// ==========================================

app.post('/api/auth/refresh', loginLimiter, async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) return res.status(401).json({ erro: "Refresh Token não fornecido." });

    try {
        // 1. Verifica a assinatura matemática usando a chave ESPECÍFICA de refresh
        const decodificado = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // 2. Proteção extra: garante que é mesmo um token do tipo refresh
        if (decodificado.typ !== 'refresh') {
            return res.status(403).json({ erro: "Tipo de token inválido para esta operação." });
        }

        // 3. Validação no Banco de Dados (Revogação)
        const [usuarios] = await db.execute(
            'SELECT id_usuario, tipoPerfil, token_renovacao FROM Usuario WHERE id_usuario = ?', 
            [decodificado.id]
        );

        const usuario = usuarios[0];

        // Se o token fornecido for diferente do que está no banco, significa que é um token velho/roubado
        if (!usuario || usuario.token_renovacao !== refreshToken) {
            // Ação defensiva: Apaga todos os tokens deste usuário por suspeita de roubo
            await db.execute('UPDATE Usuario SET token_renovacao = NULL WHERE id_usuario = ?', [decodificado.id]);
            return res.status(403).json({ erro: "Violação de segurança. Sessão terminada." });
        }

        // 4. Rotação: Gera um NOVO Access Token e um NOVO Refresh Token
        const novoTokenSessao = jwt.sign(
            { id: usuario.id_usuario, perfil: usuario.tipoPerfil, typ: 'access' },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        const novoRefreshToken = jwt.sign(
            { id: usuario.id_usuario, typ: 'refresh' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        await db.execute(
            'UPDATE Usuario SET token_renovacao = ? WHERE id_usuario = ?', 
            [novoRefreshToken, usuario.id_usuario]
        );

        res.status(200).json({ token: novoTokenSessao, refreshToken: novoRefreshToken });

    } catch (erro) {
        res.status(403).json({ erro: "Sessão expirada ou inválida. Faça login novamente." });
    }
});


const PORT = process.env.DB_PORT;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
