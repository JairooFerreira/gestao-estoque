// Usando o "Tradutor" (pacote pg) para falar com o PostgreSQL
const { Pool } = require('pg');

// Usando o "Cofre de Segredos" (pacote dotenv)
require('dotenv').config();

// Suporte a múltiplos nomes de variável:
// - POSTGRES_URL: usado localmente e no Supabase/Vercel
// - DATABASE_URL: usado pelo Render
// - Fallback: variáveis individuais do .env local (DB_HOST, etc.)
const cloudUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const connectionString = cloudUrl || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

// SSL é obrigatório na cloud (Neon, Supabase, Render, etc).
// Quando cloudUrl está definida, assume que é cloud e habilita SSL.
// Sem cloudUrl, assume banco local e desabilita SSL.
const pool = new Pool({
  connectionString,
  ssl: cloudUrl ? { rejectUnauthorized: false } : false
});

// Exportando o conector para que outros arquivos possam usá-lo
module.exports = pool;