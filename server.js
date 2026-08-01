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

// Serve static files from dist in production
app.use(express.static(path.join(__dirname, 'dist')));

// Player & Game state memory
const players = new Map();
const bots = new Map();
const killFeed = [];

// Helper to get local network IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Spawning points around the map
const SPAWN_POINTS = [
  { x: 0, y: 3, z: -35 },
  { x: 35, y: 3, z: 0 },
  { x: -35, y: 3, z: 0 },
  { x: 0, y: 3, z: 35 },
  { x: 20, y: 3, z: 20 },
  { x: -20, y: 3, z: -20 },
  { x: 25, y: 8, z: -25 }, // High platform
  { x: -25, y: 8, z: 25 }  // High platform
];

function getRandomSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

io.on('connection', (socket) => {
  console.log(`[+] Player connected: ${socket.id}`);

  // Handle player join
  socket.on('join_game', (data) => {
    const spawn = getRandomSpawn();
    const player = {
      id: socket.id,
      username: data.username || `Operative_${socket.id.slice(0, 4)}`,
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
      color: data.color || '#00f0ff',
      isBot: false
    };

    players.set(socket.id, player);

    // Send current game state to new player
    socket.emit('init_state', {
      selfId: socket.id,
      players: Array.from(players.values()),
      bots: Array.from(bots.values())
    });

    // Notify all other clients
    socket.broadcast.emit('player_joined', player);
  });

  // Handle player motion update
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

  // Handle player shooting
  socket.on('shoot', (data) => {
    const shooter = players.get(socket.id);
    if (!shooter) return;

    // Broadcast shoot effect to others
    socket.broadcast.emit('player_shot', {
      id: socket.id,
      origin: data.origin,
      direction: data.direction,
      weapon: data.weapon
    });
  });

  // Handle hit damage calculation
  socket.on('deal_damage', (data) => {
    const { targetId, damage, isHeadshot, isBot } = data;
    const attacker = players.get(socket.id);
    if (!attacker) return;

    let target = isBot ? bots.get(targetId) : players.get(targetId);
    if (!target || target.health <= 0) return;

    target.health = Math.max(0, target.health - damage);

    // Notify target client if human
    if (!isBot) {
      io.to(targetId).emit('damaged', {
        damage,
        attackerId: socket.id,
        health: target.health
      });
    }

    // Confirm hit to attacker
    socket.emit('hit_confirmed', {
      targetId,
      damage,
      isHeadshot,
      killed: target.health <= 0
    });

    // Handle elimination
    if (target.health <= 0) {
      attacker.kills++;
      target.deaths++;

      const eventText = `${attacker.username} ${isHeadshot ? '🎯 HEADSHOT' : 'eliminated'} ${target.username}`;

      io.emit('player_killed', {
        killerId: socket.id,
        victimId: targetId,
        killerName: attacker.username,
        victimName: target.username,
        isHeadshot,
        text: eventText
      });

      // Respawn target after 3s
      setTimeout(() => {
        if (isBot) {
          const b = bots.get(targetId);
          if (b) {
            const spawn = getRandomSpawn();
            b.x = spawn.x;
            b.y = spawn.y;
            b.z = spawn.z;
            b.health = 100;
            io.emit('bot_respawned', b);
          }
        } else {
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
        }
      }, 3000);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id}`);
    players.delete(socket.id);
    io.emit('player_left', { id: socket.id });
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPs();
  console.log('\n==================================================');
  console.log(`⚡ OPENERA GAME SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Local Host URL : http://localhost:${PORT}`);
  localIPs.forEach(ip => {
    console.log(`🌐 Network Play   : http://${ip}:${PORT}`);
  });
  console.log('==================================================\n');
});
