const express = require('express');
const router = express.Router();
const pool = require('./db');
const verificarToken = require('./middleware');
const { registrarLog } = require('./log');

/** @route   GET /fornecedores
 *  @desc    Busca todos os fornecedores, com filtro opcional por setor.
 *  @access  Protegido
 */
router.get('/', verificarToken, async (req, res) => {
    try {
        const { setorId, page = 1, limit = 10, termo = '' } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];

        if (setorId) {
            whereClause += ` WHERE setor_id = $${params.length + 1}`;
            params.push(setorId);
        }
        if (termo) {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += `nome ILIKE $${params.length + 1}`;
            params.push(`%${termo}%`);
        }

        const totalResult = await pool.query(`SELECT COUNT(*) FROM fornecedores ${whereClause}`, params);
        const totalItems = parseInt(totalResult.rows[0].count, 10);

        const dataQuery = `SELECT * FROM fornecedores ${whereClause} ORDER BY nome ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const fornecedoresResult = await pool.query(dataQuery, [...params, limit, offset]);

        res.json({ items: fornecedoresResult.rows, totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: parseInt(page, 10) });
    } catch (err) { res.status(500).json({ message: "Erro ao buscar fornecedores." }); }
});

/** @route   POST /fornecedores
 *  @desc    Cria um novo fornecedor.
 *  @access  Protegido
 */
router.post('/', verificarToken, async (req, res) => {
    try {
        const { nome, telefone, email, cidade, setor_id, tipos_pecas } = req.body;
        if (!nome || !setor_id) return res.status(400).json({ message: "Nome e Setor são obrigatórios." });
        const novoFornecedor = await pool.query("INSERT INTO fornecedores (nome, telefone, email, cidade, setor_id, tipos_pecas) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [nome, telefone, email, cidade, setor_id, tipos_pecas]);
        await registrarLog(req.usuario.id, `Criou o fornecedor: ${nome}`);
        res.status(201).json(novoFornecedor.rows[0]);
    } catch (err) { res.status(500).json({ message: "Erro no servidor ao criar fornecedor." }); }
});

/** @route   PUT /fornecedores/:id
 *  @desc    Atualiza um fornecedor existente.
 *  @access  Protegido
 */
router.put('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, telefone, email, cidade, setor_id, tipos_pecas } = req.body;
        if (!nome || !setor_id) return res.status(400).json({ message: "Nome e Setor são obrigatórios." });
        const fornecedorAtualizado = await pool.query("UPDATE fornecedores SET nome = $1, telefone = $2, email = $3, cidade = $4, setor_id = $5, tipos_pecas = $6 WHERE id = $7 RETURNING *", [nome, telefone, email, cidade, setor_id, tipos_pecas, id]);
        await registrarLog(req.usuario.id, `Atualizou o fornecedor: ${nome}`);
        if (fornecedorAtualizado.rowCount === 0) return res.status(404).json({ message: "Fornecedor não encontrado." });
        res.json(fornecedorAtualizado.rows[0]);
    } catch (err) { res.status(500).json({ message: "Erro no servidor ao atualizar fornecedor." }); }
});

/** @route   DELETE /fornecedores/:id
 *  @desc    Apaga um fornecedor pelo ID.
 *  @access  Protegido
 */
router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fornecedor = await client.query("SELECT nome FROM fornecedores WHERE id = $1", [id]);
        if (fornecedor.rows.length > 0) {
            await client.query("INSERT INTO historico_exclusoes (tipo_item, nome_item, usuario_id) VALUES ('fornecedor', $1, $2)", [fornecedor.rows[0].nome, req.usuario.id]);
            await registrarLog(req.usuario.id, `Apagou o fornecedor: ${fornecedor.rows[0].nome}`);
        }
        const resultado = await pool.query("DELETE FROM fornecedores WHERE id = $1", [id]);
        if (resultado.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: "Fornecedor não encontrado." }); }
        await client.query('COMMIT');
        res.status(200).json({ message: "Fornecedor apagado com sucesso." });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: "Erro no servidor ao apagar fornecedor." }); } finally {
        client.release();
    }
});

module.exports = router;