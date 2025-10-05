// Usando o "Tradutor" (pacote pg) para falar com o PostgreSQL
const { Pool } = require('pg');

// Usando o "Cofre de Segredos" (pacote dotenv)
require('dotenv').config();

// A Vercel e outros provedores de nuvem fornecem uma única URL de conexão (POSTGRES_URL).
// Esta abordagem é mais moderna e flexível.
// O código abaixo verifica se a POSTGRES_URL existe (ambiente de produção/Vercel).
// Se não existir, ele constrói a URL de conexão a partir das variáveis do seu ficheiro .env local.
const connectionString = process.env.POSTGRES_URL || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

const pool = new Pool({
  connectionString,
  // Em produção (Vercel), é obrigatório usar SSL.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Exportando o conector para que outros arquivos possam usá-lo
module.exports = pool;