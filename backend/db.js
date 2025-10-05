// Usando o "Tradutor" (pacote pg) para falar com o PostgreSQL
const { Pool } = require('pg');

// Usando o "Cofre de Segredos" (pacote dotenv)
require('dotenv').config();

// Configurando os detalhes da conexão usando as informações do nosso cofre .env
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

// Exportando o conector para que outros arquivos possam usá-lo
module.exports = pool;