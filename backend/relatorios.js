const express = require('express');
const router = express.Router();
const pool = require('./db');
const verificarToken = require('./middleware');
const PDFDocument = require('pdfkit');

/**
 * @route   GET /relatorios/estoque
 * @desc    Gera um relatório em PDF do estoque atual.
 * @access  Protegido
 */
router.get('/estoque', verificarToken, async (req, res) => {
    try {
        const produtos = await pool.query(`
            SELECT p.nome, p.quantidade, p.estoque_minimo, s.nome as setor_nome
            FROM produtos p
            LEFT JOIN setores s ON p.setor_id = s.id
            ORDER BY s.nome, p.nome
        `);

        const doc = new PDFDocument({ margin: 50 });

        // Define os cabeçalhos para o browser saber que é um PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio-estoque.pdf');

        // Envia o PDF diretamente para a resposta
        doc.pipe(res);

        // --- Conteúdo do PDF ---
        doc.fontSize(18).text('Relatório de Estoque', { align: 'center' });
        doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleDateString('pt-PT')}`, { align: 'center' });
        doc.moveDown(2);

        // Cabeçalho da tabela
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Produto', 50, 150, { width: 200 });
        doc.text('Setor', 250, 150, { width: 150 });
        doc.text('Qtd.', 400, 150, { width: 50, align: 'right' });
        doc.text('Mínimo', 460, 150, { width: 50, align: 'right' });
        doc.moveTo(50, 165).lineTo(550, 165).stroke();
        doc.font('Helvetica');

        let y = 175;
        produtos.rows.forEach(p => {
            doc.text(p.nome, 50, y, { width: 200 });
            doc.text(p.setor_nome || 'N/A', 250, y, { width: 150 });
            doc.text(p.quantidade.toString(), 400, y, { width: 50, align: 'right' });
            doc.text(p.estoque_minimo.toString(), 460, y, { width: 50, align: 'right' });
            y += 20;
            if (y > 700) { doc.addPage(); y = 50; } // Nova página se o conteúdo for muito grande
        });

        // Finaliza o PDF
        doc.end();

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro ao gerar o relatório.');
    }
});

/**
 * @route   GET /relatorios/movimentacoes
 * @desc    Busca movimentações (entradas e saídas) dentro de um período.
 * @access  Protegido
 */
router.get('/movimentacoes', verificarToken, async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;

        if (!data_inicio || !data_fim) {
            return res.status(400).json({ message: "É necessário fornecer data de início e fim." });
        }

        const query = `
            SELECT 
                m.id,
                m.tipo,
                m.quantidade,
                m.data_movimento,
                p.nome as produto_nome,
                f.nome as fornecedor_nome
            FROM movimentacoes m
            JOIN produtos p ON m.produto_id = p.id
            LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
            WHERE m.data_movimento BETWEEN $1 AND $2
            ORDER BY m.data_movimento DESC
        `;

        const movimentacoes = await pool.query(query, [data_inicio, data_fim]);
        res.json(movimentacoes.rows);

    } catch (err) { console.error(err.message); res.status(500).json({ message: "Erro no servidor ao buscar relatório de movimentações." }); }
});

module.exports = router;