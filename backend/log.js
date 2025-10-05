const pool = require('./db');

/**
 * Função auxiliar para registar uma ação no log de atividades.
 * @param {number} usuarioId - O ID do utilizador que realizou a ação.
 * @param {string} acao - A descrição da ação (ex: "Criou o produto X").
 * @param {string} [detalhes] - Detalhes adicionais sobre a ação.
 */
const registrarLog = async (usuarioId, acao, detalhes = null) => {
    try { await pool.query("INSERT INTO log_atividades (usuario_id, acao, detalhes) VALUES ($1, $2, $3)", [usuarioId, acao, detalhes]); } catch (err) { console.error('Erro ao registar log:', err.message); }
};

module.exports = { registrarLog };