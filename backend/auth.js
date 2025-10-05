const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/** @route   POST /auth/registrar
 *  @desc    Registra um novo usuário no sistema.
 *  @access  Público
 */
router.post('/registrar', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuarioExistente = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        if (usuarioExistente.rows.length > 0) {
            return res.status(400).json({ message: 'Este email já está cadastrado.' });
        }
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const novoUsuario = await pool.query("INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2) RETURNING id, email", [email, senhaHash]);
        res.status(201).json(novoUsuario.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

/** @route   POST /auth/login
 *  @desc    Autentica um usuário e retorna um token JWT.
 *  @access  Público
 */
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        if (usuario.rows.length === 0) { return res.status(401).json({ message: 'Credenciais inválidas.' }); }
        const senhaValida = await bcrypt.compare(senha, usuario.rows[0].senha_hash);
        if (!senhaValida) { return res.status(401).json({ message: 'Credenciais inválidas.' }); }
        const token = jwt.sign({ id: usuario.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } catch (err) { console.error(err.message); res.status(500).json({ message: 'Erro no servidor' }); }
});

module.exports = router;