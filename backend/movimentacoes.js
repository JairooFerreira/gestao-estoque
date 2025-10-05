const express = require('express');
const router = express.Router();
const pool = require('./db');
const verificarToken = require('./middleware');
const { registrarLog } = require('./log');

/** @route   POST /movimentacoes/entrada
 *  @desc    Registra uma entrada de estoque para um produto.
 *  @access  Protegido
 */
router.post('/entrada', verificarToken, async (req, res) => {
    const { produto_id, quantidade } = req.body;
    const qtdNum = Number(quantidade);

    if (!produto_id || !qtdNum || qtdNum <= 0) {
        return res.status(400).json({ message: "Dados inválidos. É necessário fornecer 'produto_id' e 'quantidade' (numérica e maior que zero)." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateQuery = `UPDATE produtos SET quantidade = quantidade + $1 WHERE id = $2 RETURNING nome`;
        const updatedProduct = await client.query(updateQuery, [qtdNum, produto_id]);

        if (updatedProduct.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Produto não encontrado." });
        }

        const insertQuery = `INSERT INTO movimentacoes (produto_id, tipo, quantidade, data_movimento) VALUES ($1, 'entrada', $2, NOW())`;
        await client.query(insertQuery, [produto_id, qtdNum]);

        const nomeProduto = updatedProduct.rows[0].nome;
        await registrarLog(req.usuario.id, `Registrou entrada de ${qtdNum} unidade(s) do produto: ${nomeProduto}`);

        await client.query('COMMIT');
        res.status(200).json({ message: `Entrada de ${qtdNum} unidade(s) para "${nomeProduto}" registada!` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor." });
    } finally {
        client.release();
    }
});

/** @route   POST /movimentacoes/saida
 *  @desc    Registra uma saída de estoque para um produto, com verificação de saldo.
 *  @access  Protegido
 */
router.post('/saida', verificarToken, async (req, res) => {
    const { produto_id, quantidade } = req.body;
    const qtdNum = Number(quantidade);
    if (!produto_id || !qtdNum || qtdNum <= 0) {
        return res.status(400).json({ message: "Dados inválidos. É necessário fornecer 'produto_id' e 'quantidade' (numérica e maior que zero)." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const stockCheck = await client.query("SELECT nome, quantidade FROM produtos WHERE id = $1 FOR UPDATE", [produto_id]);
        if (stockCheck.rows.length === 0) {
            throw new Error("Produto não encontrado.");
        }
        const produto = stockCheck.rows[0];
        if (produto.quantidade < qtdNum) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Estoque insuficiente para "${produto.nome}". Estoque atual: ${produto.quantidade}.` });
        }
        const updateQuery = `UPDATE produtos SET quantidade = quantidade - $1 WHERE id = $2`;
        await client.query(updateQuery, [qtdNum, produto_id]);
        const insertQuery = `INSERT INTO movimentacoes (produto_id, tipo, quantidade, data_movimento) VALUES ($1, 'saida', $2, NOW())`;
        await client.query(insertQuery, [produto_id, qtdNum]);
        await registrarLog(req.usuario.id, `Registrou saída de ${qtdNum} unidade(s) do produto: ${produto.nome}`);
        await client.query('COMMIT');
        res.status(200).json({ message: `Saída de ${qtdNum} unidade(s) de "${produto.nome}" registada com sucesso!` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        if (!res.headersSent) {
            res.status(500).json({ message: "Erro no servidor ao registar saída." });
        }
    } finally {
        client.release();
    }
});

/** @route   GET /movimentacoes
 *  @desc    Busca o histórico de movimentações (entradas/saídas), limitado aos 20 mais recentes.
 *  @access  Protegido
 */
router.get('/', verificarToken, async (req, res) => {
    try {
        const { tipo } = req.query;
        let query = `
            SELECT m.tipo, m.quantidade, m.data_movimento, p.nome as produto_nome
            FROM movimentacoes m
            JOIN produtos p ON m.produto_id = p.id
            WHERE m.tipo = $1
            ORDER BY m.data_movimento DESC LIMIT 20`;
        const movimentacoes = await pool.query(query, [tipo]);
        res.json(movimentacoes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao buscar movimentações." });
    }
});

module.exports = router;