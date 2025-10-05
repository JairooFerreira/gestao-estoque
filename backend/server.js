// --- Dependências ---
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();
const PORTA = 3000;

// --- Middlewares (Configurações Iniciais) ---
app.use(cors());
app.use(express.json());

/**
 * Rota para lidar com pedidos automáticos de ícones (.ico) pelo navegador.
 * Responde com 204 (No Content) para evitar erros 404 na consola.
 */
app.get('/*.ico', (req, res) => res.status(204).send());

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
// Centraliza todas as rotas sob o prefixo /api para consistência com a Vercel
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/setores', setoresRoutes);
apiRouter.use('/fornecedores', fornecedoresRoutes);
apiRouter.use('/movimentacoes', movimentacoesRoutes);
apiRouter.use('/relatorios', relatoriosRoutes);
apiRouter.use('/produtos', produtosRoutes);

/** @route   GET /avisos
 *  @desc    Busca todos os avisos públicos.
 *  @access  Público
 */
apiRouter.get('/avisos', async (req, res) => {
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
apiRouter.get('/usuarios', verificarToken, async (req, res) => {
    try {
        const usuarios = await pool.query("SELECT id, email FROM usuarios ORDER BY email ASC");
        res.json(usuarios.rows);
    } catch (err) { res.status(500).json({ message: "Erro ao buscar usuários." }); }
});

/** @route   GET /historico-exclusoes
 *  @desc    Busca o histórico de itens excluídos.
 *  @access  Protegido
 */
apiRouter.get('/historico-exclusoes', verificarToken, async (req, res) => {
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
apiRouter.get('/log-atividades', verificarToken, async (req, res) => {
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
//        ROTA DE DASHBOARD
// =================================

/** @route   GET /dashboard/stats
 *  @desc    Busca estatísticas para o dashboard.
 *  @access  Protegido
 */
apiRouter.get('/dashboard/stats', verificarToken, async (req, res) => {
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

// Usa o router principal da API
app.use('/api', apiRouter);

// Middleware para capturar rotas /api não encontradas
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `A rota '${req.originalUrl}' não foi encontrada no servidor.` });
});

// --- Inicialização do Servidor ---
app.listen(PORTA, () => { console.log(`Servidor rodando na porta ${PORTA}.`); });
