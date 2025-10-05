const jwt = require('jsonwebtoken');

/**
 * Middleware para verificar o token JWT em rotas protegidas.
 * Extrai o token do cabeçalho de autorização ou query string e verifica sua validade.
 */
const verificarToken = (req, res, next) => {
    const tokenQuery = req.query.token;
    const authHeader = req.headers['authorization'];
    const tokenHeader = authHeader && authHeader.split(' ')[1];
    const token = tokenHeader || tokenQuery;

    if (token == null) return res.sendStatus(401); // Não autorizado

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
        if (err) return res.sendStatus(403); // Proibido (token inválido)
        req.usuario = usuario;
        next();
    });
};

module.exports = verificarToken;