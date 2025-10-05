const express = require('express');
const router = express.Router();
const pool = require('./db');
const verificarToken = require('./middleware');
const { registrarLog } = require('./log');

// Importa e configura o multer para esta rota específica
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/**
 * @route   POST /produtos
 * @desc    Cria um novo produto. Se o fornecedor não existir, ele é criado.
 * @access  Protegido
 */
router.post('/', verificarToken, upload.single('imagem'), async (req, res) => {
    const { nome, quantidade, setor_id, fornecedor_nome, estoque_minimo } = req.body;
    const imagem_url = req.file ? `/uploads/${req.file.filename}` : null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lógica para encontrar ou criar o fornecedor
        let fornecedorId = null;
        if (fornecedor_nome && fornecedor_nome.trim() !== '') {
            let resFornecedor = await client.query("SELECT id FROM fornecedores WHERE nome ILIKE $1", [fornecedor_nome.trim()]);
            if (resFornecedor.rows.length > 0) {
                fornecedorId = resFornecedor.rows[0].id;
            } else {
                const novoFornecedor = await client.query("INSERT INTO fornecedores (nome, setor_id) VALUES ($1, $2) RETURNING id", [fornecedor_nome.trim(), setor_id]);
                fornecedorId = novoFornecedor.rows[0].id;
            }
        }

        const novoProduto = await client.query("INSERT INTO produtos (nome, quantidade, setor_id, fornecedor_id, imagem_url, estoque_minimo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [nome, quantidade, setor_id, fornecedorId, imagem_url, estoque_minimo]);
        await registrarLog(req.usuario.id, `Criou o produto: ${nome}`);
        await client.query('COMMIT');
        res.status(201).json(novoProduto.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao criar produto" });
    } finally {
        client.release();
    }
});

/**
 * @route   GET /produtos
 * @desc    Busca todos os produtos, com filtros.
 * @access  Protegido
 */
router.get('/', verificarToken, async (req, res) => {
    try {
        const { setorId, page = 1, limit = 10, termo = '', dias_sem_movimento } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];

        if (setorId) {
            whereClause += ` WHERE p.setor_id = $${params.length + 1}`;
            params.push(setorId);
        }
        if (termo) {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += `p.nome ILIKE $${params.length + 1}`;
            params.push(`%${termo}%`);
        }
        if (dias_sem_movimento && Number(dias_sem_movimento) > 0) {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += `COALESCE((SELECT MAX(data_movimento) FROM movimentacoes WHERE produto_id = p.id), p.data_criacao) < NOW() - INTERVAL '${Number(dias_sem_movimento)} days'`;
        }

        const totalResult = await pool.query(`SELECT COUNT(*) FROM produtos p ${whereClause}`, params);
        const totalItems = parseInt(totalResult.rows[0].count, 10);

        let query = `
            SELECT 
                p.*, 
                s.nome as setor_nome, 
                f.nome as fornecedor_nome, 
                (SELECT data_movimento FROM movimentacoes WHERE produto_id = p.id ORDER BY data_movimento DESC LIMIT 1) as ultima_movimentacao 
            FROM produtos p 
            LEFT JOIN setores s ON p.setor_id = s.id 
            LEFT JOIN fornecedores f ON p.fornecedor_id = f.id`;
        
        const dataParams = [...params];
        query += whereClause;
        query += ` ORDER BY p.nome ASC LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`;
        dataParams.push(limit, offset);
        
        const produtosResult = await pool.query(query, dataParams);

        res.json({ items: produtosResult.rows, totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: parseInt(page, 10) });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao buscar produtos." });
    }
});

/**
 * @route   PUT /produtos/:id
 * @desc    Atualiza um produto existente. Se o fornecedor não existir, ele é criado.
 * @access  Protegido
 */
router.put('/:id', verificarToken, upload.single('imagem'), async (req, res) => {
    const { id } = req.params;
    const { nome, quantidade, setor_id, fornecedor_nome, estoque_minimo } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let fornecedorId = null;
        if (fornecedor_nome && fornecedor_nome.trim() !== '') {
            let resFornecedor = await client.query("SELECT id FROM fornecedores WHERE nome ILIKE $1", [fornecedor_nome.trim()]);
            if (resFornecedor.rows.length > 0) {
                fornecedorId = resFornecedor.rows[0].id;
            } else {
                const novoFornecedor = await client.query("INSERT INTO fornecedores (nome, setor_id) VALUES ($1, $2) RETURNING id", [fornecedor_nome.trim(), setor_id]);
                fornecedorId = novoFornecedor.rows[0].id;
            }
        }
        let query = 'UPDATE produtos SET nome = $1, quantidade = $2, setor_id = $3, fornecedor_id = $4, estoque_minimo = $5';
        const params = [nome, quantidade, setor_id, fornecedorId, estoque_minimo];
        if (req.file) {
            query += `, imagem_url = $${params.length + 1}`;
            params.push(`/uploads/${req.file.filename}`);
        }
        query += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);
        const produtoAtualizado = await client.query(query, params);
        if (produtoAtualizado.rows.length === 0) {
            return res.status(404).json({ message: "Produto não encontrado." });
        }
        await registrarLog(req.usuario.id, `Atualizou o produto: ${nome}`);
        await client.query('COMMIT');
        res.json(produtoAtualizado.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao atualizar produto" });
    } finally {
        client.release();
    }
});

/**
 * @route   DELETE /produtos/:id
 * @desc    Apaga um produto pelo ID.
 * @access  Protegido
 */
router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const produto = await client.query("SELECT nome FROM produtos WHERE id = $1", [id]);
        if (produto.rows.length > 0) {
            await client.query("INSERT INTO historico_exclusoes (tipo_item, nome_item, usuario_id) VALUES ('produto', $1, $2)", [produto.rows[0].nome, req.usuario.id]);
            await registrarLog(req.usuario.id, `Apagou o produto: ${produto.rows[0].nome}`);
        }
        const resultado = await client.query("DELETE FROM produtos WHERE id = $1", [id]);
        if (resultado.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Produto não encontrado." });
        }
        await client.query('COMMIT');
        res.status(200).json({ message: "Produto apagado com sucesso." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: "Erro no servidor ao apagar produto" });
    } finally { client.release(); }
});

module.exports = router;