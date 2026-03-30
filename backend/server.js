// --- Dependências ---
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();
const { hash, genSalt } = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const PORTA = process.env.PORT || 3000;

// --- Middlewares (Configurações Iniciais) ---
// Configuração de CORS mais explícita para desenvolvimento e produção
const whiteList = [process.env.FRONTEND_URL, 'http://127.0.0.1:5500', 'http://localhost:5500'];
const corsOptions = {
    origin: function (origin, callback) {
        (whiteList.indexOf(origin) !== -1 || !origin) ? callback(null, true) : callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'], // Permite os cabeçalhos necessários
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Configuração para servir imagens locais ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// --- Servir Frontend em Produção ---
// Tenta primeiro a pasta copiada dinamicamente no Render, se não, usa a estrutura original
let frontendPath = path.join(__dirname, 'frontend/privado');
if (!fs.existsSync(frontendPath)) {
    frontendPath = path.join(__dirname, '../frontend/privado');
}

app.use(express.static(frontendPath));

// Redireciona a raiz para o login
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

/**
 * Rota para lidar com o pedido automático do favicon pelo navegador.
 * Responde com 204 (No Content) para evitar erros 404 na consola.
 */
app.get('/favicon.ico', (req, res) => res.status(204).send());

/**
 * Middleware de verificação de token importado.
 */
const verificarToken = require('./middleware');
const { registrarLog } = require('./log');

// --- Importação das Rotas Modulares ---
const authRoutes = require('./auth');
const setoresRoutes = require('./setores');
const fornecedoresRoutes = require('./fornecedores');
const movimentacoesRoutes = require('./movimentacoes');
const relatoriosRoutes = require('./relatorios');
const produtosRoutes = require('./produtos');


// --- ROTAS DA API ---
// As rotas são registadas diretamente no 'app'.
// A Vercel (via vercel.json) já trata do prefixo /api.
app.use('/auth', authRoutes);
app.use('/setores', setoresRoutes);
app.use('/fornecedores', fornecedoresRoutes);
app.use('/movimentacoes', movimentacoesRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/produtos', produtosRoutes);

/** @route   GET /avisos
 *  @desc    Busca todos os avisos públicos.
 *  @access  Público
 */
app.get('/avisos', async (req, res) => {
    try {
        const avisos = await pool.query("SELECT titulo, conteudo, data_criacao FROM avisos WHERE publico = TRUE ORDER BY data_criacao DESC");
        res.json(avisos.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao buscar avisos." });
    }
});

/** @route   GET /usuarios
 *  @desc    Busca todos os usuários para filtros.
 *  @access  Protegido
 */
app.get('/usuarios', verificarToken, async (req, res) => {
    try {
        const usuarios = await pool.query("SELECT id, email FROM usuarios ORDER BY email ASC");
        res.json(usuarios.rows);
    } catch (err) { res.status(500).json({ message: "Erro ao buscar usuários." }); }
});

/** @route   GET /historico-exclusoes
 *  @desc    Busca o histórico de itens excluídos.
 *  @access  Protegido
 */
app.get('/historico-exclusoes', verificarToken, async (req, res) => {
    try {
        const { tipo } = req.query;
        const query = `
            SELECT he.nome_item, he.data_exclusao, u.email as usuario_email
            FROM historico_exclusoes he
            LEFT JOIN usuarios u ON he.usuario_id = u.id
            WHERE he.tipo_item = $1
            ORDER BY he.data_exclusao DESC LIMIT 50`;
        const historico = await pool.query(query, [tipo]);
        res.json(historico.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao buscar histórico de exclusões." });
    }
});

/** @route   GET /log-atividades
 *  @desc    Busca o log de atividades do sistema.
 *  @access  Protegido
 */
app.get('/log-atividades', verificarToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, usuarioId } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];
        if (usuarioId) {
            whereClause = 'WHERE l.usuario_id = $1';
            params.push(usuarioId);
        }

        const totalResult = await pool.query(`SELECT COUNT(*) FROM log_atividades l ${whereClause}`, params);
        const totalItems = parseInt(totalResult.rows[0].count, 10);

        const logResult = await pool.query(`SELECT l.acao, l.detalhes, l.data_acao, u.email as usuario_email FROM log_atividades l JOIN usuarios u ON l.usuario_id = u.id ${whereClause} ORDER BY l.data_acao DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);

        res.json({ items: logResult.rows, totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: parseInt(page, 10) });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao buscar log de atividades." });
    }
});

// =================================
//        ROTAS DE DASHBOARD
// =================================

/** @route   GET /dashboard/stats
 *  @desc    Busca estatísticas para o dashboard.
 *  @access  Protegido
 */
app.get('/dashboard/stats', verificarToken, async (req, res) => {
    try {
        // Busca produtos com estoque baixo (ex: <= 5 unidades)
        const baixoEstoqueQuery = "SELECT id, nome, quantidade FROM produtos WHERE quantidade <= estoque_minimo AND estoque_minimo > 0 ORDER BY quantidade ASC LIMIT 5";
        const produtosBaixoEstoque = await pool.query(baixoEstoqueQuery);

        // Busca as movimentações dos últimos 30 dias para o gráfico
        const ultimasMovimentacoesQuery = `
            SELECT m.tipo, m.quantidade, m.data_movimento, p.nome as produto_nome
            FROM movimentacoes m
            JOIN produtos p ON m.produto_id = p.id
            WHERE m.data_movimento >= NOW() - INTERVAL '30 days'
            ORDER BY m.data_movimento DESC`;
        const ultimasMovimentacoes = await pool.query(ultimasMovimentacoesQuery);

        res.json({ baixoEstoque: produtosBaixoEstoque.rows, ultimasMovimentacoes: ultimasMovimentacoes.rows });
    } catch (err) { console.error(err.message); res.status(500).json({ message: "Erro no servidor ao buscar estatísticas." }); }
});

// ROTA PARA VALOR TOTAL DO ESTOQUE POR SETOR
app.get('/dashboard/valor-por-setor', verificarToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                s.nome as setor_nome, 
                s.id as setor_id,
                s.icone,
                COALESCE(SUM(p.quantidade * p.custo_medio), 0) as valor_total
            FROM setores s
            LEFT JOIN produtos p ON s.id = p.setor_id
            GROUP BY s.id
            ORDER BY valor_total DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Erro ao calcular valor do estoque por setor." });
    }
});

// ROTA PARA GASTOS (COMPRAS) POR SETOR
app.get('/dashboard/gastos-por-setor', verificarToken, async (req, res) => {
    const { ano, mes } = req.query;
    if (!ano || !mes) { return res.status(400).json({ message: "Os parâmetros 'ano' e 'mes' são obrigatórios." }); }
    try {
        const query = `
            SELECT 
                s.nome as setor_nome,
                COALESCE(SUM(m.quantidade * m.valor_unitario), 0) as total_gasto
            FROM movimentacoes m
            JOIN produtos p ON m.produto_id = p.id
            JOIN setores s ON p.setor_id = s.id
            WHERE m.tipo = 'entrada' AND EXTRACT(YEAR FROM m.data_movimento) = $1 AND EXTRACT(MONTH FROM m.data_movimento) = $2
            GROUP BY s.id
            ORDER BY total_gasto DESC;
        `;
        const result = await pool.query(query, [ano, mes]);
        res.json(result.rows);
    } catch (err) { console.error(err.message); res.status(500).json({ message: "Erro ao calcular gastos por setor." }); }
});

// --- Inicialização do Servidor ---
async function prepararAmbienteDev() {
    // Esta função só é executada se não estivermos em produção (ex: na Vercel)
    if (process.env.NODE_ENV === 'production') {
        console.log('A executar em modo de produção.');
        return;
    }

    console.log('--- A preparar ambiente de desenvolvimento ---');
    const emailDev = 'jairofelipe95@gmail.com';
    const senhaDev = '147Xolin@';

    try {
        const salt = await genSalt(10);
        const senhaHash = await hash(senhaDev, salt);

        const query = `
            INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2)
            ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash;
        `;
        await pool.query(query, [emailDev, senhaHash]);
        console.log(`✅ Utilizador de teste '${emailDev}' garantido na base de dados.`);
    } catch (err) {
        // CORREÇÃO: Exibe o erro completo e encerra o processo se a preparação falhar.
        console.error('❌ Erro ao preparar o utilizador de desenvolvimento:', err);
        process.exit(1); // Impede o servidor de arrancar se a base de dados não estiver pronta.
    }
}

app.listen(PORTA, async () => {
    await prepararAmbienteDev();
    console.log(`🚀 Servidor a postos e a rodar na porta ${PORTA}.`);
});
