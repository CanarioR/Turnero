const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const os         = require('os');
const fs         = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// ── Persistencia ───────────────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, 'state.json');

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw  = fs.readFileSync(STATE_FILE, 'utf8');
      const data = JSON.parse(raw);
      // Si el archivo es de un día anterior, ignorarlo (reset automático)
      if (data.date === todayStr()) {
        console.log(`[state] Datos restaurados del día ${data.date}`);
        return data;
      }
      console.log('[state] Nuevo día detectado — reiniciando datos');
    }
  } catch (e) {
    console.warn('[state] No se pudo leer state.json:', e.message);
  }
  return { date: todayStr(), turnCounter: 0, pendingTurns: [], calledTurns: [] };
}

function saveState() {
  try {
    const data = { date: todayStr(), turnCounter, pendingTurns, calledTurns };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.warn('[state] No se pudo guardar state.json:', e.message);
  }
}

// Reinicio automático a medianoche
let _lastDate = todayStr();
setInterval(() => {
  const today = todayStr();
  if (today !== _lastDate) {
    _lastDate    = today;
    turnCounter  = 0;
    pendingTurns = [];
    calledTurns  = [];
    saveState();
    broadcastState();
    console.log(`[state] Medianoche — datos reiniciados para el día ${today}`);
  }
}, 60_000); // comprueba cada minuto

// ── Estado global ──────────────────────────────────────────────────────────
const saved = loadState();
let turnCounter  = saved.turnCounter;
let pendingTurns = saved.pendingTurns;
let calledTurns  = saved.calledTurns;

function getState() {
  return {
    pendingTurns : pendingTurns.slice(0, 8),  // primeros 8 para pantalla
    pendingCount : pendingTurns.length,        // total real para kiosco/caja
    calledTurns  : calledTurns.slice(-4),      // últimos 4 llamados
  };
}

function broadcastState() {
  io.emit('state', getState());
}

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/',         (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/kiosco',   (_req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosco.html')));
app.get('/caja',     (_req, res) => res.sendFile(path.join(__dirname, 'public', 'caja.html')));
app.get('/pantalla', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'pantalla.html')));

// ── WebSockets ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Conectado:    ${socket.id}`);

  // Enviar estado actual al cliente recién conectado
  socket.emit('state', getState());

  // ── Generar nuevo turno (desde kiosco) ──────────────────────────────────
  socket.on('generate-turn', (callback) => {
    turnCounter++;
    pendingTurns.push(turnCounter);
    saveState();
    broadcastState();
    if (typeof callback === 'function') callback({ turn: turnCounter });
  });

  // ── Llamar siguiente turno (desde caja) ─────────────────────────────────
  socket.on('next-turn', (data, callback) => {
    const caja = data?.caja ?? 1;

    if (pendingTurns.length === 0) {
      if (typeof callback === 'function') callback({ error: 'Sin turnos pendientes' });
      return;
    }

    const turn = pendingTurns.shift();
    calledTurns.push({ turn, caja });

    // Conservar sólo los últimos 20 en memoria
    if (calledTurns.length > 20) calledTurns = calledTurns.slice(-20);

    saveState();
    broadcastState();
    io.emit('turn-called', { turn, caja }); // para sonido/animación en pantalla

    if (typeof callback === 'function') callback({ turn, caja });
  });

  socket.on('disconnect', () => console.log(`[-] Desconectado: ${socket.id}`));
});

// ── Arranque ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const ips  = [];

  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║      TURNERO  ·  Servidor Activo             ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Local  →  http://localhost:${PORT}               ║`);
  ips.forEach(ip => {
    const url = `http://${ip}:${PORT}`;
    console.log(`║  Red    →  ${url.padEnd(34)} ║`);
  });
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  /kiosco   →  Kiosco para generar turnos     ║');
  console.log('║  /caja     →  Panel del empleado             ║');
  console.log('║  /pantalla →  Pantalla pública               ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
