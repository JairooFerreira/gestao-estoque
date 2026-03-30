// ===================================================================
//  CONFIGURAÇÃO E ESTADO GLOBAL
// ===================================================================
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isVercel = window.location.hostname.includes('vercel.app');
const isRender = window.location.hostname.includes('onrender.com');

// Local: aponta para porta 3000
// Vercel: usa /api (roteado pelo vercel.json)
// Render: usa a mesma origem sem prefixo (o Express serve tudo)
const URL_BACKEND = isLocal
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : isVercel
        ? '/api'
        : `${window.location.protocol}//${window.location.hostname}`; // Render: mesma origem
const token = localStorage.getItem('token');
const mainContent = document.querySelector('.main-content');
const modalContainer = document.getElementById('modal-container');
let estadoAtual = { setorId: null, setorNome: null };
let listaDeProdutosCache = []; // Cache para autocomplete de entradas e pesquisa local

// ===================================================================
//  TEMPLATES HTML PARA RENDERIZAÇÃO DINÂMICA
// ===================================================================
const templates = {
    dashboard: `<div class="header-tela"><h1>Dashboard</h1></div><div id="dashboard-container" class="grid-dashboard"></div>`,
    estoque: `<div class="header-tela"><h1>Setores do Estoque</h1><div><button id="btn-ver-historico" class="btn btn-primario"><span class="material-icons-outlined">history</span>Ver Exclusões</button><button id="btn-add-setor" class="btn btn-sucesso"><span class="material-icons-outlined">add</span>Adicionar Setor</button></div></div><div id="container-setores" class="grid-setores"></div>`,
    produtosSetor: `<div class="header-tela"><h1 id="titulo-setor">Produtos</h1><div><button id="btn-gerar-relatorio" class="btn btn-primario"><span class="material-icons-outlined">assessment</span>Gerar Relatório</button><button id="btn-voltar-setores" class="btn btn-primario"><span class="material-icons-outlined">arrow_back</span>Voltar</button></div></div><div class="card"><input type="search" id="busca-produto" placeholder="&#x1F50D; Pesquisar produto por nome..."><div id="container-tabela-produtos"></div><div id="paginacao-produtos" class="paginacao"></div></div>`,
    cadastro: `<div class="card"><h1>Cadastrar Novo Produto</h1><form id="form-cadastro-produto" enctype="multipart/form-data"><div class="form-group"><label for="nome-produto">Nome *</label><input type="text" id="nome-produto" required></div><div class="form-group"><label for="setor-produto">Setor *</label><select id="setor-produto" required></select></div><div class="form-group"><label for="fornecedor-produto">Fornecedor</label><input type="text" id="fornecedor-produto" list="fornecedores-lista"><datalist id="fornecedores-lista"></datalist></div><div class="form-group"><label for="qtd-produto">Estoque Inicial *</label><input type="number" id="qtd-produto" value="0" min="0" required></div><div class="form-group"><label for="estoque-minimo-produto">Estoque Mínimo Recomendado</label><input type="number" id="estoque-minimo-produto" value="0" min="0"></div><div class="form-group"><label for="imagem-produto">Imagem</label><input type="file" id="imagem-produto" name="imagem" accept="image/*"></div><button type="submit" class="btn btn-primario">Salvar Produto</button></form></div>`,
    entradas: `<div class="card"><h1>Registrar Nova Entrada</h1><form id="form-registrar-entrada"><div class="form-group"><label for="entrada-produto-nome">Produto *</label><input type="text" id="entrada-produto-nome" list="produtos-lista-entrada" required><datalist id="produtos-lista-entrada"></datalist></div><div class="form-group"><label for="entrada-quantidade">Quantidade *</label><input type="number" id="entrada-quantidade" min="1" required></div><div class="form-group"><label for="entrada-valor-unitario">Valor Unitário (R$) *</label><input type="number" id="entrada-valor-unitario" step="0.01" min="0" required></div><button type="submit" class="btn btn-sucesso">Registrar Entrada</button></form></div><div id="historico-container" class="card"></div>`,
    saidas: `<div class="card"><h1>Registrar Nova Saída</h1><form id="form-registrar-saida"><div class="form-group"><label for="saida-produto-nome">Produto *</label><input type="text" id="saida-produto-nome" list="produtos-lista-saida" required><datalist id="produtos-lista-saida"></datalist></div><div class="form-group"><label for="saida-quantidade">Quantidade *</label><input type="number" id="saida-quantidade" min="1" required></div><div class="form-group"><label for="saida-destino">Destino (Opcional)</label><input type="text" id="saida-destino" placeholder="Ex: Venda, Uso interno"></div><button type="submit" class="btn btn-erro">Registrar Saída</button></form></div><div id="historico-container" class="card"></div>`,
    modalSetor: `<div id="modal-setor" class="modal" style="display:flex;"><div class="modal-conteudo"><h2>Adicionar Novo Setor</h2><form id="form-add-setor"><div class="form-group"><input type="text" id="nome-setor" placeholder="Nome do Setor" required></div><div class="form-group"><input type="text" id="icone-setor" placeholder="Ícone (ex: 'folder')"></div><button type="submit" class="btn btn-sucesso">Salvar</button></form></div></div>`,
    modalEditarProduto: `<div id="modal-editar-produto" class="modal" style="display:flex;"><div class="modal-conteudo"><h2>Editar Produto</h2><form id="form-editar-produto" enctype="multipart/form-data"><input type="hidden" id="edit-produto-id"><div class="form-group"><label>Nome *</label><input type="text" id="edit-nome-produto" required></div><div class="form-group"><label>Setor *</label><select id="edit-setor-produto" required></select></div><div class="form-group"><label>Fornecedor</label><input type="text" id="edit-fornecedor-produto" list="edit-fornecedores-lista"><datalist id="edit-fornecedores-lista"></datalist></div><div class="form-group"><label>Quantidade *</label><input type="number" id="edit-qtd-produto" min="0" required></div><div class="form-group"><label>Estoque Mínimo Recomendado</label><input type="number" id="edit-estoque-minimo-produto" value="0" min="0"></div><div class="form-group"><label for="edit-imagem-produto">Alterar Imagem</label><input type="file" id="edit-imagem-produto" name="imagem" accept="image/*"></div><button type="submit" class="btn btn-primario">Salvar Alterações</button></form></div></div>`,
    modalHistoricoExclusoes: `<div id="modal-historico" class="modal" style="display:flex;"><div class="modal-conteudo" style="max-width: 800px;"><span class="btn-fechar-modal" style="position: absolute; top: 15px; right: 20px; font-size: 24px; cursor: pointer;">&times;</span><h2>Histórico de Exclusões</h2><div id="historico-exclusoes-produtos"></div><div id="historico-exclusoes-setores" style="margin-top: 20px;"></div></div></div>`,
    fornecedores: `<div class="header-tela"><h1>Fornecedores por Setor</h1></div><div id="container-setores-fornecedores" class="grid-setores"></div>`,
    fornecedoresPorSetor: `<div class="header-tela"><h1 id="titulo-setor-fornecedor">Fornecedores</h1><div><button id="btn-add-fornecedor" class="btn btn-sucesso"><span class="material-icons-outlined">add</span>Novo Fornecedor</button><button id="btn-voltar-fornecedores" class="btn btn-primario"><span class="material-icons-outlined">arrow_back</span>Voltar</button></div></div><div class="card"><input type="search" id="busca-fornecedor" placeholder="&#x1F50D; Pesquisar fornecedor por nome..."><div id="lista-fornecedores"></div><div id="paginacao-fornecedores" class="paginacao"></div></div>`,
    modalAddFornecedor: `<div id="modal-add-fornecedor" class="modal" style="display:flex;"><div class="modal-conteudo"><h2>Novo Fornecedor</h2><form id="form-add-fornecedor"><input type="hidden" id="add-fornecedor-setor-id"><div class="form-group"><label for="fornecedor-nome">Nome *</label><input type="text" id="fornecedor-nome" required></div><div class="form-group"><label for="fornecedor-telefone">Telefone</label><input type="tel" id="fornecedor-telefone"></div><div class="form-group"><label for="fornecedor-email">Email</label><input type="email" id="fornecedor-email"></div><div class="form-group"><label for="fornecedor-cidade">Cidade</label><input type="text" id="fornecedor-cidade"></div><div class="form-group"><label for="fornecedor-tipos-pecas">Tipos de peças que oferece</label><textarea id="fornecedor-tipos-pecas" rows="3"></textarea></div><button type="submit" class="btn btn-sucesso">Cadastrar Fornecedor</button></form></div></div>`,
    modalEditarFornecedor: `<div id="modal-editar-fornecedor" class="modal" style="display:flex;"><div class="modal-conteudo"><h2>Editar Fornecedor</h2><form id="form-editar-fornecedor"><input type="hidden" id="edit-fornecedor-id"><div class="form-group"><label>Nome *</label><input type="text" id="edit-fornecedor-nome" required></div><div class="form-group"><label>Setor *</label><select id="edit-fornecedor-setor-id" required></select></div><div class="form-group"><label>Telefone</label><input type="tel" id="edit-fornecedor-telefone"></div><div class="form-group"><label>Email</label><input type="email" id="edit-fornecedor-email"></div><div class="form-group"><label>Cidade</label><input type="text" id="edit-fornecedor-cidade"></div><div class="form-group"><label for="edit-fornecedor-tipos-pecas">Tipos de peças que oferece</label><textarea id="edit-fornecedor-tipos-pecas" rows="3"></textarea></div><button type="submit" class="btn btn-primario">Salvar Alterações</button></form></div></div>`,
    relatorios: `<div class="header-tela"><h1>Relatórios de Movimentação</h1></div><div class="card"><div id="filtros-relatorio"></div></div><div id="conteudo-relatorio" class="card" style="display:none;"></div>`,
    configuracoes: `<div class="header-tela"><h1>Configurações</h1></div><div class="card"><h2>Aparência</h2><div class="form-group" style="display: flex; align-items: center; justify-content: space-between;"><label for="dark-mode-toggle">Tema Escuro (Dark Mode)</label><label class="switch"><input type="checkbox" id="dark-mode-toggle"><span class="slider"></span></label></div></div><div class="card"><h2>Sistema</h2><div id="log-atividades-container"></div><div id="paginacao-log" class="paginacao"></div></div>`
};

// ===================================================================
//  FUNÇÕES DE COMUNICAÇÃO COM A API (BACKEND)
// ===================================================================
async function fetchAPI(endpoint, options = {}) {
    if (!token) {
        // Se não houver token, não faz sentido continuar. Redireciona para o login.
        window.location.href = 'login.html';
        throw new Error('Utilizador não autenticado.');
    }

    options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    
    try {
        const res = await fetch(`${URL_BACKEND}/${endpoint}`, options);
        const contentType = res.headers.get("content-type");

        if (!res.ok) {
            // Tenta ler a mensagem de erro do corpo da resposta, se for JSON
            if (contentType && contentType.includes("application/json")) {
                const errorData = await res.json();
                throw new Error(errorData.message || `Erro ${res.status}: ${res.statusText}`);
            }
            // Caso contrário, lança um erro genérico com o status
            throw new Error(`Erro no servidor: ${res.status} ${res.statusText}`);
        }

        // Se a resposta for OK, processa o conteúdo
        if (contentType && contentType.includes("application/json")) {
            return res.json();
        }
        // Se for um ficheiro (PDF, etc.), retorna o blob para download
        return res.blob();

    } catch (err) {
        // Captura erros de rede (ex: servidor offline) ou erros lançados acima
        console.error(`Erro na chamada à API para '${endpoint}':`, err);
        throw err; // Re-lança o erro para que a função que chamou possa tratá-lo
    }
}

/**
 * Exibe uma notificação toast no canto do ecrã.
 * @param {string} mensagem - A mensagem a ser exibida.
 * @param {string} [tipo='sucesso'] - O tipo de notificação ('sucesso' ou 'erro').
 */
function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icon = tipo === 'sucesso' ? 'check_circle' : 'error';
    toast.innerHTML = `<span class="material-icons-outlined">${icon}</span> ${mensagem}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000); // Remove a notificação após 5 segundos
}

// ===================================================================
//  FUNÇÕES DE RENDERIZAÇÃO E LÓGICA DE UI
// ===================================================================
async function mostrarTela(tela) {
    mainContent.innerHTML = templates[tela] || '';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-tela="${tela}"]`);
    if(navItem) navItem.classList.add('active');
    
    const handlers = {
        dashboard: async () => { await carregarDashboard(); },
        estoque: async () => { await carregarSetores(); },
        cadastro: () => { popularDropdown('setores', 'setor-produto'); popularDatalist('fornecedores', 'fornecedores-lista'); }, // Não precisa ser async
        entradas: async () => { await popularDatalistProdutos(); await carregarHistoricoMovimentacoes('entrada'); },
        saidas: async () => { await popularDatalistProdutos(); await carregarHistoricoMovimentacoes('saida'); },
        fornecedores: async () => { await carregarSetoresParaFornecedores(); },
        relatorios: () => { renderizarFiltrosRelatorio(); },
        configuracoes: async () => { inicializarConfiguracoes(); await popularFiltroUsuarios(); await carregarLogAtividades(); }
    };
    await handlers[tela]?.(); // Usa await para esperar a conclusão de handlers assíncronos
}

async function carregarSetores() {
    const container = document.getElementById('container-setores');
    container.innerHTML = `<div class="loading-spinner"></div>`;
    try {
        const dados = await fetchAPI('setores'); // A resposta é um objeto { items: [...] }
        const listaSetores = dados.items; // Acedemos ao array dentro da propriedade 'items'
        if (listaSetores.length === 0) { container.innerHTML = `<p>Nenhum setor cadastrado.</p>`; return; }
        container.innerHTML = '';
        listaSetores.forEach(setor => container.innerHTML += `<div class="card-setor"><button class="btn-excluir-setor" data-id="${setor.id}"><span class="material-icons-outlined">delete</span></button><span class="material-icons-outlined icone-setor">${setor.icone || 'category'}</span><h3>${setor.nome}</h3><button class="btn btn-primario btn-visualizar-estoque" data-id="${setor.id}" data-nome="${setor.nome}">Visualizar Estoque</button></div>`);
    } catch (err) { container.innerHTML = `<p style="color:var(--cor-erro)">${err.message}</p>`; }
}

async function carregarProdutosPorSetor(setorId, setorNome, page = 1, termo = '') {
    estadoAtual = { setorId, setorNome };
    // Só renderiza a tela se não estiver já nela (evita piscar ao mudar de página)
    if (!document.getElementById('container-tabela-produtos')) {
        mostrarTela('produtosSetor');
    }
    document.getElementById('titulo-setor').textContent = `Produtos em ${setorNome}`;
    
    const container = document.getElementById('container-tabela-produtos');
    const buscaInput = document.getElementById('busca-produto');
    buscaInput.value = termo; // Mantém o termo de busca no input

    container.innerHTML = `<div class="loading-spinner"></div>`;
    try {
        const dadosPaginados = await fetchAPI(`produtos?setorId=${setorId}&page=${page}&termo=${encodeURIComponent(termo)}`);
        renderizarTabelaProdutos(dadosPaginados.items);
        renderizarPaginacao('paginacao-produtos', dadosPaginados, (newPage) => carregarProdutosPorSetor(setorId, setorNome, newPage, termo));
    } catch (err) { container.innerHTML = `<p style="color:var(--cor-erro)">${err.message}</p>`; }
}

function renderizarPaginacao(containerId, dadosPaginados, callbackPaginacao) {
    const container = document.getElementById(containerId);
    if (!container || dadosPaginados.totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    const { currentPage, totalPages } = dadosPaginados;
    container.innerHTML = `
        <button class="btn btn-primario" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Anterior</button>
        <span>Página ${currentPage} de ${totalPages}</span>
        <button class="btn btn-primario" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Próximo</button>
    `;
    container.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => callbackPaginacao(btn.dataset.page);
    });
}

function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function renderizarTabelaProdutos(produtos) {
    const container = document.getElementById('container-tabela-produtos');
    if (produtos.length === 0) {
        container.innerHTML = `<p>Nenhum produto encontrado.</p>`;
        return;
    }
    let tabelaHTML = `<table class="tabela-produtos"><thead><tr><th>Produto</th><th>Fornecedor</th><th>Qtd</th><th>Última Movimentação</th><th>Ações</th></tr></thead><tbody>`;
    const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    produtos.forEach(p => {
        // Se a imagem_url já for um URL completo (começa com http), usa-o diretamente.
        // Caso contrário, monta o URL com o placeholder.
        const isFullUrl = p.imagem_url && p.imagem_url.startsWith('http');
        const imgUrl = isFullUrl ? p.imagem_url : `https://via.placeholder.com/40/2c3e50/FFFFFF?text=${encodeURIComponent(p.nome.charAt(0).toUpperCase())}`;
        const ultimaMovFormatada = p.ultima_movimentacao 
            ? new Date(p.ultima_movimentacao).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'N/A';
        const dadosProduto = `data-id="${p.id}" data-nome="${p.nome}" data-qtd="${p.quantidade}" data-setor-id="${p.setor_id}" data-fornecedor-nome="${p.fornecedor_nome || ''}" data-estoque-minimo="${p.estoque_minimo || 0}"`;
        const classeEstoque = p.quantidade <= p.estoque_minimo ? 'estoque-baixo' : '';
        const avisoEstoque = classeEstoque ? '<span class="aviso-estoque">Atenção</span>' : '';
        
        tabelaHTML += `
            <tr>
                <td data-label="Produto"><img src="${imgUrl}" alt=""> ${p.nome} <br><small style="color: var(--cor-texto-secundario)">Custo Unit.: ${formatadorMoeda.format(p.custo_medio)}</small></td>
                <td data-label="Valor Total" style="font-weight: 500;">${formatadorMoeda.format(p.quantidade * p.custo_medio)}</td>
                <td data-label="Qtd" class="${classeEstoque}">${p.quantidade} ${avisoEstoque}</td>
                <td data-label="Última Mov.">${ultimaMovFormatada}</td>
                <td data-label="Ações" class="acoes">
                    <button class="btn btn-editar btn-editar-produto" ${dadosProduto}><span class="material-icons-outlined">edit</span></button>
                    <button class="btn btn-erro btn-apagar-produto" data-id="${p.id}"><span class="material-icons-outlined">delete</span></button>
                </td>
            </tr>`;
    });
    container.innerHTML = tabelaHTML + `</tbody></table>`;
}

async function carregarDashboard() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `<div class="loading-spinner"></div>`;
    try {
        // Carrega os dados em paralelo
        const [stats, valorPorSetor] = await Promise.all([
            fetchAPI('dashboard/stats'),
            fetchAPI('dashboard/valor-por-setor')
        ]);
        const { baixoEstoque, ultimasMovimentacoes } = stats;

        let baixoEstoqueHtml = `<div class="card"><h2><span class="material-icons-outlined">warning</span> Produtos com Baixo Estoque</h2>`;
        if (baixoEstoque.length > 0) {
            baixoEstoqueHtml += `<ul>${baixoEstoque.map(p => `<li>${p.nome} <strong>(${p.quantidade})</strong></li>`).join('')}</ul>`;
        } else { baixoEstoqueHtml += `<p>Nenhum produto com baixo estoque.</p>`; }
        baixoEstoqueHtml += `</div>`;
        
        // Card de Valor em Estoque por Setor
        const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorTotalEstoque = valorPorSetor.reduce((acc, item) => acc + parseFloat(item.valor_total), 0);

        let valorEstoqueHtml = `
            <div class="card" style="grid-column: span 2; text-align: center;">
                <h2><span class="material-icons-outlined">monetization_on</span> Valor Total em Estoque</h2>
                <p class="valor-card" style="font-size: 2.5em; margin-top: 10px;">${formatadorMoeda.format(valorTotalEstoque)}</p>
            </div>
            <div class="card" style="grid-column: span 2;"><h2><span class="material-icons-outlined">inventory_2</span> Detalhes por Setor</h2>`;

        if (valorPorSetor.length > 0) {
            valorEstoqueHtml += `<div class="grid-setores">`;
            valorPorSetor.forEach(item => {
                valorEstoqueHtml += `<div class="card-setor btn-visualizar-estoque" data-id="${item.setor_id}" data-nome="${item.setor_nome}">
                    <span class="material-icons-outlined icone-setor">${item.icone || 'category'}</span>
                    <h3>${item.setor_nome}</h3>
                </div>`;
            });
            valorEstoqueHtml += `</div>`;
        } else {
            valorEstoqueHtml += `<p>Nenhum valor em estoque para exibir.</p>`;
        }
        valorEstoqueHtml += `</div>`;

        // Card de Setor que mais gastou
        const dataAtual = new Date();
        const anoAtual = dataAtual.getFullYear();
        const mesAtual = dataAtual.getMonth() + 1;
        let gastosSetorHtml = `<div class="card" id="card-gastos-setor" style="grid-column: span 2;">
            <div class="header-tela" style="margin-bottom: 15px;">
                <h2><span class="material-icons-outlined">shopping_cart</span> Gastos por Setor</h2>
                <div style="display: flex; gap: 10px;">
                    <select id="filtro-mes-gastos" class="form-control" style="padding: 5px;">${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1 === mesAtual ? 'selected' : ''}>${new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>`).join('')}</select>
                    <select id="filtro-ano-gastos" class="form-control" style="padding: 5px;">${Array.from({length: 5}, (_, i) => `<option value="${anoAtual-i}" ${anoAtual-i === anoAtual ? 'selected' : ''}>${anoAtual-i}</option>`).join('')}</select>
                </div>
            </div>
            <div id="tabela-gastos-setor"></div>
        </div>`;

        // Cards para últimas entradas e saídas
        const renderizarTabelaMovimentacoes = (movs, titulo) => {
            let html = `<div class="card"><h2><span class="material-icons-outlined">sync_alt</span> ${titulo}</h2>`;
            if (movs.length > 0) {
                html += `<table class="tabela-produtos"><thead><tr><th>Produto</th><th>Qtd</th><th>Data</th></tr></thead><tbody>`;
                movs.slice(0, 5).forEach(m => { // Limita a 5 itens
                    html += `<tr><td>${m.produto_nome}</td><td>${m.quantidade}</td><td>${new Date(m.data_movimento).toLocaleDateString('pt-PT')}</td></tr>`;
                });
                html += `</tbody></table>`;
            } else {
                html += `<p>Nenhuma movimentação recente.</p>`;
            }
            return html + `</div>`;
        };

        const ultimasEntradas = ultimasMovimentacoes.filter(m => m.tipo === 'entrada');
        const ultimasSaidas = ultimasMovimentacoes.filter(m => m.tipo === 'saida');

        const ultimasEntradasHtml = renderizarTabelaMovimentacoes(ultimasEntradas, 'Últimas Entradas');
        const ultimasSaidasHtml = renderizarTabelaMovimentacoes(ultimasSaidas, 'Últimas Saídas');

        container.innerHTML = baixoEstoqueHtml + gastosSetorHtml + ultimasEntradasHtml + ultimasSaidasHtml;

        await carregarGraficoGastos(); // Carrega o gráfico de gastos inicial

        // Adiciona listeners para os filtros de gastos
        document.getElementById('filtro-mes-gastos').onchange = carregarGraficoGastos;
        document.getElementById('filtro-ano-gastos').onchange = carregarGraficoGastos;
    } catch (err) { container.innerHTML = `<div class="card"><p style="color:var(--cor-erro)">${err.message}</p></div>`; }
}

async function popularDropdown(endpoint, dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    try {
        // Pede todos os itens para preencher o dropdown, ignorando a paginação padrão
        const dadosPaginados = await fetchAPI(`${endpoint}?limit=1000`);
        dropdown.innerHTML = `<option value="" disabled selected>Selecione</option>`;
        dadosPaginados.items.forEach(item => dropdown.innerHTML += `<option value="${item.id}">${item.nome}</option>`);
    } catch (err) {
        dropdown.innerHTML = `<option value="" disabled>Erro ao carregar</option>`;
    }
}

async function popularDatalist(endpoint, datalistId) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    try {
        const dadosPaginados = await fetchAPI(`${endpoint}?limit=1000`);
        const itens = dadosPaginados.items;
        datalist.innerHTML = '';
        itens.forEach(item => datalist.innerHTML += `<option value="${item.nome}">`);
    } catch (err) {
        console.error(`Erro ao popular datalist ${datalistId}:`, err);
    }
}

async function carregarGraficoGastos() {
    const mes = document.getElementById('filtro-mes-gastos').value;
    const ano = document.getElementById('filtro-ano-gastos').value;
    const containerTabela = document.getElementById('tabela-gastos-setor');
    containerTabela.innerHTML = `<div class="loading-spinner"></div>`;

    // CORREÇÃO: Adicionado try/catch para tratar erros de API.
    // Antes, qualquer falha aqui deixava o spinner travado sem mensagem ao utilizador.
    try {
        const gastosPorSetor = await fetchAPI(`dashboard/gastos-por-setor?ano=${ano}&mes=${mes}`);
        
        if (gastosPorSetor.length > 0) {
            const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
            let cardsHTML = `<div class="grid-setores" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">`;
            gastosPorSetor.forEach(item => {
                cardsHTML += `<div class="card-dashboard" style="cursor: default;">
                    <span class="material-icons-outlined icone-card">paid</span>
                    <h4>${item.setor_nome}</h4>
                    <p class="valor-card" style="color: var(--cor-erro);">${formatadorMoeda.format(item.total_gasto)}</p>
                </div>`;
            });
            containerTabela.innerHTML = cardsHTML + `</div>`;
        } else {
            containerTabela.innerHTML = `<p>Nenhum gasto registrado para este período.</p>`;
        }
    } catch (err) {
        containerTabela.innerHTML = `<p style="color:var(--cor-erro)">Erro ao carregar gastos: ${err.message}</p>`;
    }
}

async function popularDatalistProdutos() {
    // Seleciona o datalist da tela atual, seja de entrada ou saída
    const datalist = document.querySelector('#produtos-lista-entrada, #produtos-lista-saida');
    if (!datalist) return;
    try {
        const dadosPaginados = await fetchAPI('produtos?limit=1000'); // Pede um limite alto para obter todos os produtos
        listaDeProdutosCache = dadosPaginados.items;
        datalist.innerHTML = '';
        listaDeProdutosCache.forEach(p => datalist.innerHTML += `<option value="${p.nome}">`);
    } catch (e) {
        console.error('Erro ao carregar produtos para datalist:', e);
    }
}

async function carregarHistoricoMovimentacoes(tipo) {
    const container = document.getElementById('historico-container');
    if (!container) return;

    const titulo = tipo === 'entrada' ? 'Últimas Entradas' : 'Últimas Saídas';
    container.innerHTML = `<h2>${titulo}</h2><div class="loading-spinner"></div>`;

    try {
        const historico = await fetchAPI(`movimentacoes?tipo=${tipo}`);
        if (historico.length === 0) {
            container.innerHTML = `<h2>${titulo}</h2><p>Nenhuma movimentação registada.</p>`;
            return;
        }

        let tabelaHTML = `<h2>${titulo}</h2><table class="tabela-produtos"><thead><tr><th>Produto</th><th>Quantidade</th><th>Data</th></tr></thead><tbody>`;
        historico.forEach(mov => {
            const dataFormatada = new Date(mov.data_movimento).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            tabelaHTML += `<tr><td>${mov.produto_nome}</td><td>${mov.quantidade}</td><td>${dataFormatada}</td></tr>`;
        });
        container.innerHTML = tabelaHTML + `</tbody></table>`;

    } catch (err) {
        container.innerHTML = `<h2>${titulo}</h2><p style="color:var(--cor-erro)">${err.message}</p>`;
    }
}

async function carregarHistoricoExclusoes(tipo, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const titulo = tipo === 'produto' ? 'Produtos Excluídos Recentemente' : 'Setores Excluídos Recentemente';
    container.innerHTML = `<h2>${titulo}</h2><div class="loading-spinner"></div>`;

    try {
        const historico = await fetchAPI(`historico-exclusoes?tipo=${tipo}`);
        if (historico.length === 0) {
            container.innerHTML = `<h2>${titulo}</h2><p>Nenhum item excluído.</p>`;
            return;
        }

        let tabelaHTML = `<h2>${titulo}</h2><table class="tabela-produtos"><thead><tr><th>Nome do Item</th><th>Excluído por</th><th>Data da Exclusão</th></tr></thead><tbody>`;
        historico.forEach(item => {
            const dataFormatada = new Date(item.data_exclusao).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            tabelaHTML += `<tr><td>${item.nome_item}</td><td>${item.usuario_email || 'N/A'}</td><td>${dataFormatada}</td></tr>`;
        });
        container.innerHTML = tabelaHTML + `</tbody></table>`;

    } catch (err) {
        container.innerHTML = `<h2>${titulo}</h2><p style="color:var(--cor-erro)">${err.message}</p>`;
    }
}

async function carregarSetoresParaFornecedores() {
    const container = document.getElementById('container-setores-fornecedores');
    container.innerHTML = `<div class="loading-spinner"></div>`;
    try {
        const dados = await fetchAPI('setores');
        const listaSetores = dados.items;
        if (listaSetores.length === 0) { container.innerHTML = `<p>Nenhum setor cadastrado. Cadastre um setor primeiro.</p>`; return; }
        container.innerHTML = '';
        listaSetores.forEach(setor => container.innerHTML += `<div class="card-setor"><span class="material-icons-outlined icone-setor">${setor.icone || 'business_center'}</span><h3>${setor.nome}</h3><button class="btn btn-primario btn-visualizar-fornecedores" data-id="${setor.id}" data-nome="${setor.nome}">Ver Fornecedores</button></div>`);
    } catch (err) { container.innerHTML = `<p style="color:var(--cor-erro)">${err.message}</p>`; }
}

// CORREÇÃO: A função renderizarGraficoMovimentacoes foi removida pois era código morto.
// Ela referenciava um <canvas id="grafico-movimentacoes"> que não existe em nenhum template do HTML,
// o que causaria um TypeError ao tentar chamar .getContext('2d') em null.

async function carregarFornecedoresPorSetor(setorId, setorNome, page = 1, termo = '') {
    estadoAtual = { setorId, setorNome };
    mostrarTela('fornecedoresPorSetor');
    document.getElementById('titulo-setor-fornecedor').textContent = `Fornecedores de ${setorNome}`;
    
    const container = document.getElementById('lista-fornecedores');
    const buscaInput = document.getElementById('busca-fornecedor');
    buscaInput.value = termo;

    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
        const dadosPaginados = await fetchAPI(`fornecedores?setorId=${setorId}&page=${page}&termo=${encodeURIComponent(termo)}`);
        if (dadosPaginados.items.length === 0) { container.innerHTML = '<p>Nenhum fornecedor cadastrado.</p>'; return; }
        container.innerHTML = '';
        dadosPaginados.items.forEach(f => {
            const dadosFornecedor = `data-id="${f.id}" data-nome="${f.nome}" data-telefone="${f.telefone || ''}" data-email="${f.email || ''}" data-cidade="${f.cidade || ''}" data-setor-id="${f.setor_id}" data-tipos-pecas="${f.tipos_pecas || ''}"`;
            container.innerHTML += `
                <div class="accordion-item">
                    <div class="accordion-item-botoes">
                        <button class="btn btn-editar btn-editar-fornecedor" ${dadosFornecedor}><span class="material-icons-outlined">edit</span></button>
                        <button class="btn btn-erro btn-apagar-fornecedor" data-id="${f.id}"><span class="material-icons-outlined">delete</span></button>
                    </div>
                    <div class="accordion-header">
                        <span>${f.nome}</span>
                    </div>
                    <div class="accordion-body">
                        <p><strong>Telefone:</strong> ${f.telefone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${f.email || 'N/A'}</p>
                        <p><strong>Cidade:</strong> ${f.cidade || 'N/A'}</p>
                        <p><strong>Peças:</strong> ${f.tipos_pecas || 'N/A'}</p>
                    </div>
                </div>`;
        });
        renderizarPaginacao('paginacao-fornecedores', dadosPaginados, (newPage) => carregarFornecedoresPorSetor(setorId, setorNome, newPage, termo));

    } catch (err) { container.innerHTML = `<p style="color:var(--cor-erro)">${err.message}</p>`; }
}

async function gerarRelatorio(e) {
    e.preventDefault();
    const tipo = document.getElementById('tipo-relatorio').value;
    let dataInicio, dataFim;

    if (tipo === 'diario') {
        const data = document.getElementById('data-diaria').value;
        dataInicio = `${data}T00:00:00`;
        dataFim = `${data}T23:59:59`;
    } else if (tipo === 'semanal') {
        const dataSelecionada = new Date(document.getElementById('data-diaria').value + 'T00:00:00');
        const diaDaSemana = dataSelecionada.getDay();
        const inicioSemana = new Date(dataSelecionada);
        inicioSemana.setDate(dataSelecionada.getDate() - diaDaSemana);
        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);
        dataInicio = `${inicioSemana.toISOString().split('T')[0]}T00:00:00`;
        dataFim = `${fimSemana.toISOString().split('T')[0]}T23:59:59`;
    } else if (tipo === 'mensal') {
        const [ano, mes] = document.getElementById('data-mensal').value.split('-');
        dataInicio = `${ano}-${mes}-01T00:00:00`;
        const ultimoDia = new Date(ano, mes, 0).getDate();
        dataFim = `${ano}-${mes}-${ultimoDia}T23:59:59`;
    }

    const containerRelatorio = document.getElementById('conteudo-relatorio');
    containerRelatorio.style.display = 'block';
    containerRelatorio.innerHTML = `<div class="loading-spinner"></div>`;

    try {
        const movimentacoes = await fetchAPI(`relatorios/movimentacoes?data_inicio=${dataInicio}&data_fim=${dataFim}`);
        const entradas = movimentacoes.filter(m => m.tipo === 'entrada');
        const saidas = movimentacoes.filter(m => m.tipo === 'saida');

        const formatarTabela = (titulo, dados, tipo) => {
            let html = `<h3>${titulo}</h3>`;
            if (dados.length === 0) return html + '<p>Nenhuma movimentação neste período.</p>';
            const cabecalhoExtra = tipo === 'entrada' ? '<th>Fornecedor</th>' : '<th>Destino</th>';
            html += `<table class="tabela-produtos"><thead><tr><th>Data</th><th>Produto</th><th>Quantidade</th>${cabecalhoExtra}</tr></thead><tbody>`;
            dados.forEach(m => {
                html += `<tr><td>${new Date(m.data_movimento).toLocaleString('pt-PT')}</td><td>${m.produto_nome}</td><td>${m.quantidade}</td><td>${m.fornecedor_nome || 'N/A'}</td></tr>`;
            });
            return html + '</tbody></table>';
        };

        containerRelatorio.innerHTML = `
            <div class="header-tela">
                <h2>Relatório do Período</h2>
                <div>
                    <button id="btn-imprimir-relatorio" class="btn btn-primario"><span class="material-icons-outlined">print</span>Imprimir</button>
                    <button id="btn-pdf-relatorio" class="btn btn-sucesso"><span class="material-icons-outlined">picture_as_pdf</span>Salvar como PDF</button>
                </div>
            </div>
            <div id="relatorio-imprimivel">
                ${formatarTabela('Entradas', entradas, 'entrada')}
                ${formatarTabela('Saídas', saidas, 'saida')}
            </div>
        `;
    } catch (err) { containerRelatorio.innerHTML = `<p style="color:var(--cor-erro)">${err.message}</p>`; }
}

function inicializarConfiguracoes() {
    const toggle = document.getElementById('dark-mode-toggle');
    // Define o estado inicial do toggle com base no que está guardado
    toggle.checked = localStorage.getItem('theme') === 'dark';

    toggle.addEventListener('change', (e) => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
    });
}

function toggleButtonSpinner(btn, show) {
    if (show) {
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-spinner"></span>`;
        btn.classList.add('loading');
    } else {
        btn.disabled = false;
        // O texto original precisa ser restaurado. Isso pode ser melhorado guardando o texto original num data-attribute.
        btn.innerHTML = btn.dataset.originalText || 'Salvar';
        btn.classList.remove('loading');
    }
}

async function popularFiltroUsuarios() {
    const dropdown = document.getElementById('filtro-log-usuario');
    if (!dropdown) return;
    try {
        const usuarios = await fetchAPI('usuarios');
        usuarios.forEach(user => {
            dropdown.innerHTML += `<option value="${user.id}">${user.email}</option>`;
        });
        dropdown.onchange = () => carregarLogAtividades(1);
    } catch (err) {
        console.error('Erro ao popular filtro de usuários:', err);
    }
}

async function carregarLogAtividades(page = 1) {
    const container = document.getElementById('log-atividades-container');
    const filtroUsuario = document.getElementById('filtro-log-usuario');
    const usuarioId = filtroUsuario ? filtroUsuario.value : '';
    container.innerHTML = `<div class="loading-spinner"></div>`;

    try {
        const dadosPaginados = await fetchAPI(`log-atividades?page=${page}&usuarioId=${usuarioId}`);
        if (dadosPaginados.items.length === 0) {
            container.innerHTML = '<h3>Log de Atividades</h3><p>Nenhuma atividade registada.</p>';
            return;
        }

        let tabelaHTML = `<h3>Log de Atividades</h3><table class="tabela-produtos"><thead><tr><th>Data</th><th>Utilizador</th><th>Ação</th></tr></thead><tbody>`;
        dadosPaginados.items.forEach(log => {
            const dataFormatada = new Date(log.data_acao).toLocaleString('pt-PT');
            tabelaHTML += `<tr><td>${dataFormatada}</td><td>${log.usuario_email}</td><td>${log.acao}</td></tr>`;
        });
        container.innerHTML = tabelaHTML + '</tbody></table>';

        renderizarPaginacao('paginacao-log', dadosPaginados, carregarLogAtividades);

    } catch (err) {
        container.innerHTML = `<h3>Log de Atividades</h3><p style="color:var(--cor-erro)">${err.message}</p>`;
    }
}

// ===================================================================
//  MANIPULADORES DE EVENTOS (EVENT LISTENERS)
// ===================================================================
document.querySelector('.sidebar-nav').addEventListener('click', (e) => {
    const navLink = e.target.closest('li.nav-item');
    if (navLink) {
        e.preventDefault();
        mostrarTela(navLink.dataset.tela); // A função mostrarTela agora é async
    }
});

mainContent.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-add-setor')) { modalContainer.innerHTML = templates.modalSetor; }
    if (e.target.closest('#btn-ver-historico')) {
        modalContainer.innerHTML = templates.modalHistoricoExclusoes;
        await carregarHistoricoExclusoes('produto', 'historico-exclusoes-produtos');
        await carregarHistoricoExclusoes('setor', 'historico-exclusoes-setores');
    }
    if (e.target.closest('#btn-gerar-relatorio')) {
        try {
            const blob = await fetchAPI('relatorios/estoque');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'relatorio-estoque.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) { mostrarNotificacao(`Erro ao gerar o relatório: ${err.message}`, 'erro'); }
    }
    if (e.target.closest('#btn-imprimir-relatorio')) {
        const conteudo = document.getElementById('relatorio-imprimivel').innerHTML;
        const janela = window.open('', '', 'height=500, width=800');
        janela.document.write('<html><head><title>Relatório de Movimentação</title>');
        janela.document.write('<style>body{font-family:sans-serif;} table{width:100%; border-collapse:collapse;} th,td{border:1px solid #ddd; padding:8px; text-align:left;}</style>');
        janela.document.write('</head><body>');
        janela.document.write(conteudo);
        janela.document.write('</body></html>');
        janela.document.close();
        janela.print();
    }
    if (e.target.closest('#btn-pdf-relatorio')) {
        const elemento = document.getElementById('relatorio-imprimivel');
        const opt = {
            margin:       1,
            filename:     'relatorio_movimentacao.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Desativa o botão para evitar cliques múltiplos
        e.target.closest('#btn-pdf-relatorio').disabled = true;
        html2pdf().from(elemento).set(opt).save().then(() => { e.target.closest('#btn-pdf-relatorio').disabled = false; });
    }
    if (e.target.closest('#btn-exportar-grafico')) {
        const canvas = document.getElementById('grafico-movimentacoes');
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'grafico-movimentacoes.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    if (e.target.closest('.btn-visualizar-estoque')) { const btn = e.target.closest('.btn-visualizar-estoque'); carregarProdutosPorSetor(btn.dataset.id, btn.dataset.nome, 1, '', ''); }
    if (e.target.closest('.btn-excluir-setor')) { const btn = e.target.closest('.btn-excluir-setor'); if (confirm('Tem a certeza?')) { try { await fetchAPI(`setores/${btn.dataset.id}`, { method: 'DELETE' }); mostrarNotificacao('Setor apagado com sucesso.'); carregarSetores(); } catch (err) { mostrarNotificacao(err.message, 'erro'); } } }
    if (e.target.closest('#btn-voltar-setores')) { mostrarTela('estoque'); }
    if (e.target.closest('#btn-voltar-fornecedores')) { mostrarTela('fornecedores'); }
    if (e.target.closest('.btn-visualizar-fornecedores')) { const btn = e.target.closest('.btn-visualizar-fornecedores'); carregarFornecedoresPorSetor(btn.dataset.id, btn.dataset.nome, 1, ''); }
    if (e.target.closest('.btn-apagar-produto')) { const btn = e.target.closest('.btn-apagar-produto'); if (confirm('Tem a certeza?')) { try { await fetchAPI(`produtos/${btn.dataset.id}`, { method: 'DELETE' }); mostrarNotificacao('Produto apagado com sucesso.'); carregarProdutosPorSetor(estadoAtual.setorId, estadoAtual.setorNome); } catch (err) { mostrarNotificacao(err.message, 'erro'); } } }
    if (e.target.closest('.btn-editar-produto')) {
        const btn = e.target.closest('.btn-editar-produto');
        modalContainer.innerHTML = templates.modalEditarProduto;
        document.getElementById('edit-produto-id').value = btn.dataset.id;
        document.getElementById('edit-nome-produto').value = btn.dataset.nome;
        document.getElementById('edit-qtd-produto').value = btn.dataset.qtd;
        document.getElementById('edit-fornecedor-produto').value = btn.dataset.fornecedorNome;
        document.getElementById('edit-estoque-minimo-produto').value = btn.dataset.estoqueMinimo;
        await popularDropdown('setores', 'edit-setor-produto');
        document.getElementById('edit-setor-produto').value = btn.dataset.setorId;
        await popularDatalist('fornecedores', 'edit-fornecedores-lista');
    }
    if (e.target.closest('.accordion-header')) {
        const header = e.target.closest('.accordion-header');
        // Evita que o clique nos botões de ação dispare o accordion
        if (!e.target.closest('.btn')) {
            header.parentElement.classList.toggle('active');
        }
    }
    if (e.target.closest('#btn-add-fornecedor')) { modalContainer.innerHTML = templates.modalAddFornecedor; document.getElementById('add-fornecedor-setor-id').value = estadoAtual.setorId; }
    if (e.target.closest('.btn-apagar-fornecedor')) { const btn = e.target.closest('.btn-apagar-fornecedor'); if (confirm('Tem a certeza?')) { try { await fetchAPI(`fornecedores/${btn.dataset.id}`, { method: 'DELETE' }); mostrarNotificacao('Fornecedor apagado com sucesso.'); carregarFornecedoresPorSetor(estadoAtual.setorId, estadoAtual.setorNome); } catch (err) { mostrarNotificacao(err.message, 'erro'); } } }
    if (e.target.closest('.btn-editar-fornecedor')) {
        const btn = e.target.closest('.btn-editar-fornecedor');
        modalContainer.innerHTML = templates.modalEditarFornecedor;
        document.getElementById('edit-fornecedor-id').value = btn.dataset.id;
        document.getElementById('edit-fornecedor-nome').value = btn.dataset.nome;
        document.getElementById('edit-fornecedor-telefone').value = btn.dataset.telefone; document.getElementById('edit-fornecedor-email').value = btn.dataset.email; document.getElementById('edit-fornecedor-cidade').value = btn.dataset.cidade; document.getElementById('edit-fornecedor-tipos-pecas').value = btn.dataset.tiposPecas;
        await popularDropdown('setores', 'edit-fornecedor-setor-id');
        document.getElementById('edit-fornecedor-setor-id').value = btn.dataset.setorId;
    }
});

mainContent.addEventListener('input', debounce((e) => {
    // Delegação de evento para o campo de busca de produtos
    if (e.target.id === 'busca-produto') {
        const { setorId, setorNome } = estadoAtual;
        carregarProdutosPorSetor(setorId, setorNome, 1, e.target.value);
    }
    // Delegação de evento para o campo de busca de fornecedores
    if (e.target.id === 'busca-fornecedor') {
        const { setorId, setorNome } = estadoAtual;
        carregarFornecedoresPorSetor(setorId, setorNome, 1, e.target.value);
    }
}, 300));

mainContent.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const btnSalvarNovo = e.submitter && e.submitter.id === 'btn-salvar-e-novo';
    
    const submitButton = e.submitter || btn;
    if (submitButton) {
        submitButton.dataset.originalText = submitButton.innerHTML;
        toggleButtonSpinner(submitButton, true);
    }

    try {
        switch (form.id) {
            case 'form-cadastro-produto': {
                const formData = new FormData(form);
                formData.append('nome', form.querySelector('#nome-produto').value);
                formData.append('setor_id', form.querySelector('#setor-produto').value);
                formData.append('fornecedor_nome', form.querySelector('#fornecedor-produto').value);
                formData.append('quantidade', form.querySelector('#qtd-produto').value);
                formData.append('estoque_minimo', form.querySelector('#estoque-minimo-produto').value);
                
                await fetchAPI('produtos', { method: 'POST', body: formData });
                mostrarNotificacao('Produto cadastrado com sucesso!');
                form.reset();
                if (!btnSalvarNovo) {
                    mostrarTela('estoque');
                }
                break;
            }
            case 'form-registrar-entrada': {
                const nomeProduto = form.querySelector('#entrada-produto-nome').value;
                const produto = listaDeProdutosCache.find(p => p.nome.toLowerCase() === nomeProduto.toLowerCase());
                if (!produto) throw new Error('Produto não encontrado.');
                const dados = { produto_id: produto.id, quantidade: parseInt(form.querySelector('#entrada-quantidade').value), valor_unitario: parseFloat(form.querySelector('#entrada-valor-unitario').value) };
                const resultado = await fetchAPI('movimentacoes/entrada', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
                mostrarNotificacao(resultado.message);
                form.reset();
                await carregarHistoricoMovimentacoes('entrada');
                break;
            }
            case 'form-registrar-saida': {
                const nomeProduto = form.querySelector('#saida-produto-nome').value;
                const produto = listaDeProdutosCache.find(p => p.nome.toLowerCase() === nomeProduto.toLowerCase());
                if (!produto) throw new Error('Produto não encontrado.');
                const dados = { produto_id: produto.id, quantidade: parseInt(form.querySelector('#saida-quantidade').value), destino: form.querySelector('#saida-destino').value };
                const resultado = await fetchAPI('movimentacoes/saida', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
                mostrarNotificacao(resultado.message);
                form.reset();
                await carregarHistoricoMovimentacoes('saida');
                break;
            }
            case 'form-gerar-relatorio':
                await gerarRelatorio(e);
                break;
        }
    } catch (err) {
        mostrarNotificacao(err.message, 'erro');
    } finally {
        if (submitButton) toggleButtonSpinner(submitButton, false);
    }
});

// ===================================================================
//  INICIALIZAÇÃO
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Aplica o tema guardado assim que a página carrega
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    if (!token) { window.location.href = 'login.html'; return; }
    mostrarTela('dashboard');
    document.querySelector('.btn-sair').addEventListener('click', () => { localStorage.removeItem('token'); window.location.href = 'login.html'; });
});

modalContainer.addEventListener('click', (e) => {
    // Fecha o modal se clicar fora do conteúdo ou no botão de fechar
    if (e.target.classList.contains('modal') || e.target.classList.contains('btn-fechar-modal')) {
        modalContainer.innerHTML = '';
    }
});

modalContainer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.dataset.originalText = btn.innerHTML;
        toggleButtonSpinner(btn, true);
    }    
    try {
        if (form.id === 'form-add-setor') { await fetchAPI('setores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: form.querySelector('#nome-setor').value, icone: form.querySelector('#icone-setor').value }) }); modalContainer.innerHTML = ''; await carregarSetores(); }
        if (form.id === 'form-editar-produto') {
            const id = form.querySelector('#edit-produto-id').value;
            const formData = new FormData();
            formData.append('nome', form.querySelector('#edit-nome-produto').value);
            formData.append('quantidade', form.querySelector('#edit-qtd-produto').value);
            formData.append('setor_id', form.querySelector('#edit-setor-produto').value);
            formData.append('fornecedor_nome', form.querySelector('#edit-fornecedor-produto').value);
            formData.append('estoque_minimo', form.querySelector('#edit-estoque-minimo-produto').value);
            // A imagem não é editada aqui, mas poderia ser adicionada uma lógica para isso
            const imagemInput = form.querySelector('#edit-imagem-produto');
            if (imagemInput.files[0]) {
                formData.append('imagem', imagemInput.files[0]);
            }
            await fetchAPI(`produtos/${id}`, { method: 'PUT', body: formData });
            modalContainer.innerHTML = '';
            await carregarProdutosPorSetor(estadoAtual.setorId, estadoAtual.setorNome);
        }
        if (form.id === 'form-add-fornecedor') { const dados = { nome: form.querySelector('#fornecedor-nome').value, telefone: form.querySelector('#fornecedor-telefone').value, email: form.querySelector('#fornecedor-email').value, cidade: form.querySelector('#fornecedor-cidade').value, setor_id: parseInt(form.querySelector('#add-fornecedor-setor-id').value), tipos_pecas: form.querySelector('#fornecedor-tipos-pecas').value }; await fetchAPI('fornecedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }); modalContainer.innerHTML = ''; await carregarFornecedoresPorSetor(estadoAtual.setorId, estadoAtual.setorNome); }
        if (form.id === 'form-editar-fornecedor') { const id = form.querySelector('#edit-fornecedor-id').value; await fetchAPI(`fornecedores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: form.querySelector('#edit-fornecedor-nome').value, telefone: form.querySelector('#edit-fornecedor-telefone').value, email: form.querySelector('#edit-fornecedor-email').value, cidade: form.querySelector('#edit-fornecedor-cidade').value, setor_id: parseInt(form.querySelector('#edit-fornecedor-setor-id').value), tipos_pecas: form.querySelector('#edit-fornecedor-tipos-pecas').value }) }); modalContainer.innerHTML = ''; await carregarFornecedoresPorSetor(estadoAtual.setorId, estadoAtual.setorNome); }
    } catch (err) {
        mostrarNotificacao(err.message, 'erro');
    } finally {
        if (btn) toggleButtonSpinner(btn, false);
    }
});