const express = require('express');
const router = express.Router();
const pool = require('./db');
const verificarToken = require('./middleware');
const { registrarLog } = require('./log');

/** @route   GET /setores
 *  @desc    Busca todos os setores.
 *  @access  Protegido
 */
router.get('/', verificarToken, async (req, res) => {
    try {
        // Adicionamos a mesma estrutura de resposta que as outras rotas
        const setoresResult = await pool.query("SELECT * FROM setores ORDER BY nome ASC");
        // O frontend espera um objeto com a propriedade 'items'
        res.json({ items: setoresResult.rows });
    } catch (err) {
        res.status(500).json({ message: "Erro no servidor" });
    }
});

/** @route   POST /setores
 *  @desc    Cria um novo setor.
 *  @access  Protegido
 */
router.post('/', verificarToken, async (req, res) => {
    try {
        const { nome, icone } = req.body;
        const novoSetor = await pool.query("INSERT INTO setores (nome, icone) VALUES ($1, $2) RETURNING *", [nome, icone]);
        await registrarLog(req.usuario.id, `Criou o setor: ${nome}`);
        res.status(201).json(novoSetor.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Erro no servidor" });
    }
});

/** @route   DELETE /setores/:id
 *  @desc    Apaga um setor pelo ID.
 *  @access  Protegido
 */
router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Antes de apagar, verifica se o setor existe para registar no histórico
        const setor = await client.query("SELECT nome FROM setores WHERE id = $1", [id]);
        if (setor.rows.length > 0) {
            const nomeSetor = setor.rows[0].nome;
            await client.query("INSERT INTO historico_exclusoes (tipo_item, nome_item, usuario_id) VALUES ('setor', $1, $2)", [nomeSetor, req.usuario.id]);
            await registrarLog(req.usuario.id, `Apagou o setor: ${nomeSetor}`);
        }

        const resultado = await client.query("DELETE FROM setores WHERE id = $1", [id]);
        if (resultado.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Setor não encontrado." });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "Setor apagado com sucesso." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        // Adiciona uma verificação para evitar conflitos com a exclusão de produtos (que também podem estar no setor)
        if (err.code === '23503') { // foreign key violation
            return res.status(400).json({ message: "Não é possível apagar o setor. Existem produtos ou fornecedores associados a ele." });
        }
        res.status(500).json({ message: "Erro no servidor ao apagar setor." });
    } finally {
        client.release();
    }
});

module.exports = router;