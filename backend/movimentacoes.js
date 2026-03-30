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
    const { produto_id, quantidade, valor_unitario } = req.body;
    const qtdNum = Number(quantidade);
    const valorUnitarioNum = parseFloat(valor_unitario);

    if (!produto_id || !qtdNum || qtdNum <= 0 || valorUnitarioNum < 0) {
        return res.status(400).json({ message: "Dados inválidos. Verifique o produto, a quantidade e o valor unitário." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obter o estado atual do produto (quantidade e custo médio antigo)
        const produtoAtual = await client.query("SELECT nome, quantidade, custo_medio FROM produtos WHERE id = $1 FOR UPDATE", [produto_id]);
        if (produtoAtual.rows.length === 0) {
            throw new Error("Produto não encontrado.");
        }
        const { nome: nomeProduto, quantidade: qtdAntiga, custo_medio: custoMedioAntigo } = produtoAtual.rows[0];

        // 2. Calcular o novo custo médio ponderado
        const qtdNovaTotal = Number(qtdAntiga) + qtdNum;
        const novoCustoMedio = ((Number(custoMedioAntigo) * Number(qtdAntiga)) + (valorUnitarioNum * qtdNum)) / qtdNovaTotal;

        // 3. Atualizar o produto com a nova quantidade e o novo custo médio
        const updateQuery = `UPDATE produtos SET quantidade = $1, custo_medio = $2 WHERE id = $3`;
        await client.query(updateQuery, [qtdNovaTotal, novoCustoMedio, produto_id]);

        // 4. Registrar a movimentação de entrada com o valor da compra
        const insertQuery = `INSERT INTO movimentacoes (produto_id, tipo, quantidade, valor_unitario, data_movimento) VALUES ($1, 'entrada', $2, $3, NOW())`;
        await client.query(insertQuery, [produto_id, qtdNum, valorUnitarioNum]);

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
    const { produto_id, quantidade, destino } = req.body; // Adicionamos 'destino'
    const qtdNum = Number(quantidade);
    if (!produto_id || !qtdNum || qtdNum <= 0) {
        return res.status(400).json({ message: "Dados inválidos. É necessário fornecer 'produto_id' e 'quantidade' (numérica e maior que zero)." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Obtemos também o custo médio para registrar na saída
        const stockCheck = await client.query("SELECT nome, quantidade, custo_medio FROM produtos WHERE id = $1 FOR UPDATE", [produto_id]);
        if (stockCheck.rows.length === 0) {
            throw new Error("Produto não encontrado.");
        }
        const produto = stockCheck.rows[0];
        if (produto.quantidade < qtdNum) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Estoque insuficiente para "${produto.nome}". Estoque atual: ${produto.quantidade}.` });
        }

        // O custo médio não muda na saída, apenas a quantidade.
        const updateQuery = `UPDATE produtos SET quantidade = quantidade - $1 WHERE id = $2`;
        await client.query(updateQuery, [qtdNum, produto_id]);

        // Registramos a saída com o custo do produto naquele momento (custo médio)
        const insertQuery = `INSERT INTO movimentacoes (produto_id, tipo, quantidade, valor_unitario, data_movimento) VALUES ($1, 'saida', $2, $3, NOW())`;
        await client.query(insertQuery, [produto_id, qtdNum, produto.custo_medio]);

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

        // CORREÇÃO: Valida o parâmetro 'tipo' antes de usá-lo na query.
        // Sem isso, `tipo` seria undefined e causaria erro no PostgreSQL.
        if (!tipo || !['entrada', 'saida'].includes(tipo)) {
            return res.status(400).json({ message: "Parâmetro 'tipo' é obrigatório e deve ser 'entrada' ou 'saida'." });
        }

        const query = `
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