
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

const PORT = Number(process.env.PORT) || 3018;
const API_KEY = process.env.API_KEY || '';
const DATA_FILE = path.resolve(
  process.env.DATA_FILE || './dados/frota.json'
);

app.use(express.json({ limit: '2mb' }));

function carregarDados() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function salvarDados(dados) {
  dados.telemetria.ultimaAtualizacao = new Date().toISOString();

  const temporario = `${DATA_FILE}.tmp`;

  fs.writeFileSync(
    temporario,
    JSON.stringify(dados, null, 2) + '\n',
    'utf8'
  );

  fs.renameSync(temporario, DATA_FILE);
}

function autenticarApiKey(req, res, next) {
  const chave = req.get('X-API-KEY');

  if (!API_KEY || !chave || chave !== API_KEY) {
    return res.status(401).json({
      erro: 'Chave de API ausente ou inválida.'
    });
  }

  next();
}

function validarId(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function buscarVeiculo(dados, id) {
  return dados.veiculos.find((veiculo) => veiculo.id === id);
}

function proximoId(itens) {
  return itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

function validarTexto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function registrarRequisicao(req, res, next) {
  const inicio = Date.now();

  res.on('finish', () => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - inicio}ms`
    );
  });

  next();
}

app.use(registrarRequisicao);

app.get('/api/v1/health', (req, res) => {
  const memoria = process.memoryUsage();

  return res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    memoria,
    plataforma: os.platform(),
    hostname: os.hostname(),
    pid: process.pid
  });
});

app.get('/api/v1/telemetria', (req, res) => {
  const dados = carregarDados();

  return res.status(200).json({
    api: {
      status: 'OK',
      uptime: process.uptime(),
      memoria: process.memoryUsage()
    },
    sistema: {
      hostname: os.hostname(),
      plataforma: os.platform(),
      memoriaTotal: os.totalmem(),
      memoriaLivre: os.freemem(),
      carga: os.loadavg()
    },
    frota: {
      totalVeiculos: dados.veiculos.length,
      totalMotoristas: dados.motoristas.length,
      ultimaAtualizacao: dados.telemetria.ultimaAtualizacao
    }
  });
});

app.get('/api/v1/veiculos', (req, res) => {
  const dados = carregarDados();
  const { status, montadora } = req.query;

  let resultado = dados.veiculos;

  if (status) {
    resultado = resultado.filter(
      (veiculo) =>
        veiculo.status.toUpperCase() === String(status).toUpperCase()
    );
  }

  if (montadora) {
    resultado = resultado.filter(
      (veiculo) =>
        veiculo.montadora.toLowerCase() === String(montadora).toLowerCase()
    );
  }

  return res.status(200).json(resultado);
});

app.get('/api/v1/veiculos/:id', (req, res) => {
  const id = validarId(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const dados = carregarDados();
  const veiculo = buscarVeiculo(dados, id);

  if (!veiculo) {
    return res.status(404).json({ erro: 'Veículo não encontrado.' });
  }

  return res.status(200).json(veiculo);
});

app.post('/api/v1/veiculos', (req, res) => {
  const { placa, montadora, modelo } = req.body || {};

  if (
    !validarTexto(placa) ||
    !validarTexto(montadora) ||
    !validarTexto(modelo)
  ) {
    return res.status(400).json({
      erro: 'Placa, montadora e modelo são obrigatórios.'
    });
  }

  const dados = carregarDados();

  const placaNormalizada = placa.trim().toUpperCase();

  if (
    dados.veiculos.some(
      (veiculo) => veiculo.placa.toUpperCase() === placaNormalizada
    )
  ) {
    return res.status(409).json({
      erro: 'Já existe um veículo cadastrado com essa placa.'
    });
  }

  const novoVeiculo = {
    id: proximoId(dados.veiculos),
    placa: placaNormalizada,
    montadora: montadora.trim(),
    modelo: modelo.trim(),
    status: 'DISPONIVEL'
  };

  dados.veiculos.push(novoVeiculo);
  salvarDados(dados);

  return res.status(201).json(novoVeiculo);
});

app.put('/api/v1/veiculos/:id', (req, res) => {
  const id = validarId(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const { placa, montadora, modelo, status } = req.body || {};

  if (
    !validarTexto(placa) ||
    !validarTexto(montadora) ||
    !validarTexto(modelo) ||
    !validarTexto(status)
  ) {
    return res.status(400).json({
      erro: 'Informe placa, montadora, modelo e status.'
    });
  }

  const dados = carregarDados();
  const veiculo = buscarVeiculo(dados, id);

  if (!veiculo) {
    return res.status(404).json({ erro: 'Veículo não encontrado.' });
  }

  const placaNormalizada = placa.trim().toUpperCase();

  if (
    dados.veiculos.some(
      (item) => item.id !== id && item.placa === placaNormalizada
    )
  ) {
    return res.status(409).json({ erro: 'Placa já cadastrada.' });
  }

  veiculo.placa = placaNormalizada;
  veiculo.montadora = montadora.trim();
  veiculo.modelo = modelo.trim();
  veiculo.status = status.trim().toUpperCase();

  salvarDados(dados);

  return res.status(200).json(veiculo);
});

app.patch('/api/v1/veiculos/:id', (req, res) => {
  const id = validarId(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const camposPermitidos = ['placa', 'montadora', 'modelo', 'status'];
  const camposRecebidos = Object.keys(req.body || {});

  if (
    camposRecebidos.length === 0 ||
    camposRecebidos.some((campo) => !camposPermitidos.includes(campo))
  ) {
    return res.status(400).json({
      erro: 'Informe pelo menos um campo válido para atualizar.'
    });
  }

  const dados = carregarDados();
  const veiculo = buscarVeiculo(dados, id);

  if (!veiculo) {
    return res.status(404).json({ erro: 'Veículo não encontrado.' });
  }

  for (const campo of camposRecebidos) {
    if (!validarTexto(req.body[campo])) {
      return res.status(400).json({
        erro: `O campo ${campo} deve ser um texto não vazio.`
      });
    }
  }

  if (req.body.placa) {
    const placa = req.body.placa.trim().toUpperCase();

    if (
      dados.veiculos.some(
        (item) => item.id !== id && item.placa === placa
      )
    ) {
      return res.status(409).json({ erro: 'Placa já cadastrada.' });
    }

    veiculo.placa = placa;
  }

  for (const campo of ['montadora', 'modelo']) {
    if (req.body[campo]) {
      veiculo[campo] = req.body[campo].trim();
    }
  }

  if (req.body.status) {
    veiculo.status = req.body.status.trim().toUpperCase();
  }

  salvarDados(dados);

  return res.status(200).json(veiculo);
});

app.delete('/api/v1/veiculos/:id', (req, res) => {
  const id = validarId(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const dados = carregarDados();
  const indice = dados.veiculos.findIndex((item) => item.id === id);

  if (indice === -1) {
    return res.status(404).json({ erro: 'Veículo não encontrado.' });
  }

  const [removido] = dados.veiculos.splice(indice, 1);
  salvarDados(dados);

  return res.status(200).json({
    mensagem: 'Veículo removido com sucesso.',
    veiculo: removido
  });
});

app.get('/api/v1/motoristas', autenticarApiKey, (req, res) => {
  const dados = carregarDados();
  return res.status(200).json(dados.motoristas);
});

app.use((req, res) => {
  return res.status(404).json({
    erro: 'Rota não encontrada.'
  });
});

app.use((err, req, res, next) => {
  console.error('[ERRO]', err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }

  return res.status(500).json({
    erro: 'Erro interno do servidor.'
  });
});

if (!fs.existsSync(DATA_FILE)) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({
      veiculos: [],
      motoristas: [],
      telemetria: { ultimaAtualizacao: null }
    }, null, 2) + '\n'
  );
}

app.listen(PORT, () => {
  console.log(`[Binário Tech] API iniciada na porta ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/v1/health`);
});

