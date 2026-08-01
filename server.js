import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'dist')));

// Pure Real Player Game State (NO BOTS)
const players = new Map();
let gameMode = 'FFA'; // 'FFA' or 'TDM'
let teamScores = { alpha: 0, bravo: 0 };

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Spawning points across Mega City District
const SPAWN_POINTS = [
  { x: 0, y: 0, z: -60 },
  { x: 60, y: 0, z: 0 },
  { x: -60, y: 0, z: 0 },
  { x: 0, y: 0, z: 60 },
  { x: 45, y: 0, z: 45 },
  { x: -45, y: 0, z: -45 },
  { x: 80, y: 0, z: -80 },
  { x: -80, y: 0, z: 80 },
  { x: 0, y: 14, z: -20 }, // Skybridge Spawn
  { x: -70, y: 12, z: -70 } // Rooftop Spawn
];

function getRandomSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

io.on('connection', (socket) => {
  console.log(`[+] Real Player Connected: ${socket.id}`);

  socket.on('join_game', (data) => {
    const spawn = getRandomSpawn();
    
    // Assign team for TDM mode automatically to balance teams
    let team = 'none';
    if (data.mode) gameMode = data.mode;

    if (gameMode === 'TDM') {
      let alphaCount = 0;
      let bravoCount = 0;
      players.forEach(p => {
        if (p.team === 'alpha') alphaCount++;
        if (p.team === 'bravo') bravoCount++;
      });
      team = alphaCount <= bravoCount ? 'alpha' : 'bravo';
    }

    const player = {
      id: socket.id,
      username: data.username || `Player_${socket.id.slice(0, 4)}`,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      rotX: 0,
      rotY: 0,
      health: 100,
      maxHealth: 100,
      kills: 0,
      deaths: 0,
      weapon: data.weapon || 'assault',
      team: team,
      color: team === 'alpha' ? '#00f0ff' : team === 'bravo' ? '#ff007f' : '#10b981'
    };

    players.set(socket.id, player);

    // Send init state to joined player
    socket.emit('init_state', {
      selfId: socket.id,
      mode: gameMode,
      teamScores,
      players: Array.from(players.values())
    });

    // Notify all other clients
    socket.broadcast.emit('player_joined', player);
  });

  socket.on('change_weapon', (data) => {
    const p = players.get(socket.id);
    if (p) {
      p.weapon = data.weapon;
      socket.broadcast.emit('player_changed_weapon', { id: socket.id, weapon: data.weapon });
    }
  });

  socket.on('player_update', (data) => {
    const p = players.get(socket.id);
    if (!p) return;

    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotX = data.rotX;
    p.rotY = data.rotY;
    p.crouch = data.crouch;

    socket.broadcast.emit('player_moved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      z: p.z,
      rotX: p.rotX,
      rotY: p.rotY,
      crouch: p.crouch
    });
  });

  socket.on('shoot', (data) => {
    const shooter = players.get(socket.id);
    if (!shooter) return;

    socket.broadcast.emit('player_shot', {
      id: socket.id,
      origin: data.origin,
      direction: data.direction,
      weapon: data.weapon
    });
  });

  socket.on('deal_damage', (data) => {
    const { targetId, damage, isHeadshot } = data;
    const attacker = players.get(socket.id);
    const target = players.get(targetId);

    if (!attacker || !target || target.health <= 0) return;

    // Prevent friendly fire in TDM mode
    if (gameMode === 'TDM' && attacker.team === target.team) {
      return;
    }

    target.health = Math.max(0, target.health - damage);

    io.to(targetId).emit('damaged', {
      damage,
      attackerId: socket.id,
      health: target.health
    });

    socket.emit('hit_confirmed', {
      targetId,
      damage,
      isHeadshot,
      killed: target.health <= 0
    });

    if (target.health <= 0) {
      attacker.kills++;
      target.deaths++;

      if (gameMode === 'TDM') {
        if (attacker.team === 'alpha') teamScores.alpha++;
        else if (attacker.team === 'bravo') teamScores.bravo++;
      }

      const eventText = `${attacker.username} ${isHeadshot ? '🎯 HEADSHOT' : 'eliminated'} ${target.username}`;

      io.emit('player_killed', {
        killerId: socket.id,
        victimId: targetId,
        killerName: attacker.username,
        victimName: target.username,
        isHeadshot,
        teamScores,
        text: eventText
      });

      // Respawn after 3s
      setTimeout(() => {
        const p = players.get(targetId);
        if (p) {
          const spawn = getRandomSpawn();
          p.x = spawn.x;
          p.y = spawn.y;
          p.z = spawn.z;
          p.health = 100;
          io.to(targetId).emit('respawn', { x: p.x, y: p.y, z: p.z, health: 100 });
          io.emit('player_respawned', { id: targetId, x: p.x, y: p.y, z: p.z });
        }
      }, 3000);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Player Disconnected: ${socket.id}`);
    players.delete(socket.id);
    io.emit('player_left', { id: socket.id });
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPs();
  console.log('\n==================================================');
  console.log(`⚡ OPENERA MEGA CITY REAL-PLAYER SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Local Host URL : http://localhost:${PORT}`);
  localIPs.forEach(ip => {
    console.log(`🌐 Network Play   : http://${ip}:${PORT}`);
  });
  console.log('==================================================\n');
});
