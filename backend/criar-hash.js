// Ficheiro: backend/criar-hash.js
const bcrypt = require('bcryptjs');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Digite a senha que deseja encriptar: ', async (senha) => {
  if (!senha) {
    console.log('Nenhuma senha fornecida. A sair.');
    readline.close();
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);
    console.log('\n============================================================');
    console.log('Seu hash bcrypt está pronto!');
    console.log('Copie a linha abaixo e use-a no seu comando SQL:');
    console.log(hash);
    console.log('============================================================');
  } catch (err) {
    console.error('Erro ao gerar o hash:', err);
  } finally {
    readline.close();
  }
});
