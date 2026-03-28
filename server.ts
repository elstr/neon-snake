/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  Orb,
  WORLD_SIZE,
  BASE_SPEED,
  BOOST_SPEED,
  TICK_RATE,
  MAX_ORBS,
  MAX_POWERUPS,
  INITIAL_LENGTH,
  SEGMENT_SPACING,
  TURN_SPEED,
  PowerUpType,
  POWERUP_DURATION,
  PORTAL_LIFE,
  BLACK_HOLE_RADIUS,
  BLACK_HOLE_LIFE,
  MISSILE_SPEED,
} from './src/shared/types.ts';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = 3000;

const COLORS = [
  '#ff7eb3', // vibrant pink
  '#ffb86c', // vibrant orange
  '#f1fa8c', // vibrant yellow
  '#50fa7b', // vibrant green
  '#8be9fd', // vibrant blue
  '#bd93f9', // vibrant purple
];

const rooms: Record<string, GameState> = {};

const POWERUP_COLORS: Record<PowerUpType, string> = {
  [PowerUpType.SPEED]: '#ff0000', // Red
  [PowerUpType.INVINCIBILITY]: '#ffff00', // Yellow
  [PowerUpType.SHRINK_OPPONENTS]: '#0000ff', // Blue
  [PowerUpType.MISSILES]: '#ff00ff', // Magenta
  [PowerUpType.PORTAL]: '#00ffff', // Cyan
  [PowerUpType.BLACK_HOLE]: '#ffffff', // White
};

const blackHoleHits: Record<string, Set<string>> = {}; // roomId -> Set(playerId_blackHoleId)
const lastFireTime: Record<string, number> = {}; // playerId -> timestamp
const orbSpawnCount: Record<string, number> = {}; // roomId -> count
const lastBlackHoleSpawn: Record<string, number> = {}; // roomId -> timestamp

function getOrCreateRoom(roomId: string): GameState {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: {},
      orbs: {},
      powerUps: {},
      missiles: {},
      portals: {},
      blackHoles: {},
      leaderboard: [],
    };
    // Initial orbs for new room
    for (let i = 0; i < 150; i++) {
      spawnOrbInRoom(rooms[roomId]);
    }
  }
  return rooms[roomId];
}

function spawnOrbInRoom(roomState: GameState, x?: number, y?: number, value = 1, color?: string, force = false): boolean {
  if (!force && Object.keys(roomState.orbs).length >= MAX_ORBS) return false;
  const id = uuidv4();
  roomState.orbs[id] = {
    id,
    x: x ?? (Math.random() - 0.5) * WORLD_SIZE,
    y: y ?? (Math.random() - 0.5) * WORLD_SIZE,
    value,
    color: color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  return true;
}

function spawnPowerUpInRoom(roomState: GameState) {
  if (Object.keys(roomState.powerUps).length >= MAX_POWERUPS) return;
  const id = uuidv4();
  const types = Object.values(PowerUpType);
  const type = types[Math.floor(Math.random() * types.length)];
  roomState.powerUps[id] = {
    id,
    x: (Math.random() - 0.5) * WORLD_SIZE,
    y: (Math.random() - 0.5) * WORLD_SIZE,
    type,
    color: POWERUP_COLORS[type],
  };
}

let snakeCounter = 1;

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  let currentRoomId: string | null = null;

  socket.on('join', (data: { name?: string, roomId?: string }) => {
    const roomId = data?.roomId || 'global';
    currentRoomId = roomId;
    socket.join(roomId);

    const roomState = getOrCreateRoom(roomId);
    const name = data?.name || `Snake-${snakeCounter++}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const startX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
    const startY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
    const angle = Math.random() * Math.PI * 2;

    const segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      segments.push({
        x: startX - Math.cos(angle) * i * SEGMENT_SPACING,
        y: startY - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }

    roomState.players[socket.id] = {
      id: socket.id,
      name,
      color,
      segments,
      score: INITIAL_LENGTH,
      isBoosting: false,
      state: 'alive',
      currentAngle: angle,
      inputs: { left: false, right: false, boost: false },
      isInvincible: false,
      isShrunk: false,
      missileCount: 0,
      portalCount: 0,
      speedMultiplier: 1,
    };

    socket.emit('init', socket.id);
  });

  socket.on('update_state', (data: { segments: any[], score: number, currentAngle: number, isBoosting: boolean, state: string, speedMultiplier?: number }) => {
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    if (!roomState) return;

    const player = roomState.players[socket.id];
    if (player && player.state === 'alive') {
      player.segments = data.segments;
      player.score = data.score;
      player.currentAngle = data.currentAngle;
      player.isBoosting = data.isBoosting;
      if (data.speedMultiplier !== undefined) {
        player.speedMultiplier = data.speedMultiplier;
      }
      
      if (data.state === 'dead') {
        player.state = 'dead';
        // Drop orbs
        player.segments.forEach((seg, i) => {
          if (i % 2 === 0) spawnOrbInRoom(roomState, seg.x, seg.y, 1, player.color, true);
        });
      }
    }
  });

  socket.on('collect_orb', (orbId: string) => {
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    if (roomState && roomState.orbs[orbId]) {
      delete roomState.orbs[orbId];
    }
  });

  socket.on('collect_powerup', (powerUpId: string) => {
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    const powerUp = roomState?.powerUps[powerUpId];
    if (!powerUp) return;

    const player = roomState.players[socket.id];
    if (!player || player.state !== 'alive') return;

    delete roomState.powerUps[powerUpId];

    switch (powerUp.type) {
      case PowerUpType.SPEED:
        player.speedMultiplier = 2;
        setTimeout(() => {
          if (roomState.players[socket.id]) roomState.players[socket.id].speedMultiplier = 1;
        }, POWERUP_DURATION);
        break;
      case PowerUpType.INVINCIBILITY:
        player.isInvincible = true;
        setTimeout(() => {
          if (roomState.players[socket.id]) roomState.players[socket.id].isInvincible = false;
        }, POWERUP_DURATION);
        break;
      case PowerUpType.SHRINK_OPPONENTS:
        Object.values(roomState.players).forEach(p => {
          if (p.id !== socket.id) {
            p.isShrunk = true;
            setTimeout(() => {
              if (roomState.players[p.id]) roomState.players[p.id].isShrunk = false;
            }, POWERUP_DURATION);
          }
        });
        break;
      case PowerUpType.MISSILES:
        player.missileCount += 5;
        break;
      case PowerUpType.PORTAL:
        player.portalCount += 1;
        break;
      case PowerUpType.BLACK_HOLE:
        const bhId = uuidv4();
        roomState.blackHoles[bhId] = {
          id: bhId,
          ownerId: socket.id,
          x: player.segments[0].x + Math.cos(player.currentAngle) * 15,
          y: player.segments[0].y + Math.sin(player.currentAngle) * 15,
          radius: BLACK_HOLE_RADIUS,
          expiresAt: Date.now() + BLACK_HOLE_LIFE,
        };
        break;
    }
  });

  socket.on('fire_missile', () => {
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    const player = roomState?.players[socket.id];
    if (!player || player.state !== 'alive' || player.missileCount <= 0) return;

    const now = Date.now();
    if (lastFireTime[socket.id] && now - lastFireTime[socket.id] < 500) return;
    lastFireTime[socket.id] = now;

    player.missileCount--;
    const missileId = uuidv4();
    roomState.missiles[missileId] = {
      id: missileId,
      ownerId: socket.id,
      x: player.segments[0].x,
      y: player.segments[0].y,
      angle: player.currentAngle,
    };
  });

  socket.on('activate_portal', () => {
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    const player = roomState?.players[socket.id];
    if (!player || player.state !== 'alive' || player.portalCount <= 0) return;

    player.portalCount--;
    const portalId = uuidv4();
    const angle = player.currentAngle;
    const dist = 10;
    roomState.portals[portalId] = {
      id: portalId,
      ownerId: socket.id,
      x1: player.segments[0].x + Math.cos(angle) * dist,
      y1: player.segments[0].y + Math.sin(angle) * dist,
      x2: (Math.random() - 0.5) * WORLD_SIZE,
      y2: (Math.random() - 0.5) * WORLD_SIZE,
      expiresAt: Date.now() + PORTAL_LIFE,
    };
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    if (!roomState) return;

    const player = roomState.players[socket.id];
    if (player && player.state === 'alive') {
      // Drop orbs
      player.segments.forEach((seg, i) => {
        if (i % 2 === 0) spawnOrbInRoom(roomState, seg.x, seg.y, 1, player.color, true);
      });
    }
    delete roomState.players[socket.id];

    // Clean up empty rooms (except global)
    if (currentRoomId !== 'global' && Object.keys(roomState.players).length === 0) {
      delete rooms[currentRoomId];
    }
  });
});

// Game Loop
setInterval(() => {
  for (const roomId in rooms) {
    const roomState = rooms[roomId];
    const now = Date.now();

    // Update players (just for boosting orb drops)
    for (const id in roomState.players) {
      const player = roomState.players[id];
      if (player.state === 'alive' && player.isBoosting) {
        if (Math.random() < 0.1 && player.segments.length > 0) {
          const tail = player.segments[player.segments.length - 1];
          spawnOrbInRoom(roomState, tail.x, tail.y, 1, player.color, true);
        }
      }
    }

    // Spawn random orbs
    if (Math.random() < 0.2) {
      const activePlayers = Object.values(roomState.players).filter(p => p.state === 'alive');
      let spawned = false;
      if (activePlayers.length > 0 && Math.random() < 0.7) {
        const targetPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];
        const head = targetPlayer.segments[0];
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 20;
        const x = head.x + Math.cos(angle) * dist;
        const y = head.y + Math.sin(angle) * dist;
        const boundary = WORLD_SIZE / 2;
        const clampedX = Math.max(-boundary, Math.min(boundary, x));
        const clampedY = Math.max(-boundary, Math.min(boundary, y));
        spawned = spawnOrbInRoom(roomState, clampedX, clampedY);
      } else {
        spawned = spawnOrbInRoom(roomState);
      }
      
      // 3:1 orb to power-up spawn ratio
      if (spawned) {
        orbSpawnCount[roomId] = (orbSpawnCount[roomId] || 0) + 1;
        if (orbSpawnCount[roomId] >= 3) {
          spawnPowerUpInRoom(roomState);
          orbSpawnCount[roomId] = 0;
        }
      }
    }

    // Spawn random black holes every 3 seconds
    if (!lastBlackHoleSpawn[roomId] || now - lastBlackHoleSpawn[roomId] >= 3000) {
      const bhId = uuidv4();
      roomState.blackHoles[bhId] = {
        id: bhId,
        ownerId: 'server',
        x: (Math.random() - 0.5) * WORLD_SIZE,
        y: (Math.random() - 0.5) * WORLD_SIZE,
        radius: BLACK_HOLE_RADIUS,
        expiresAt: now + BLACK_HOLE_LIFE,
      };
      lastBlackHoleSpawn[roomId] = now;
    }

    // Update missiles
    for (const id in roomState.missiles) {
      const missile = roomState.missiles[id];
      missile.x += Math.cos(missile.angle) * (MISSILE_SPEED / TICK_RATE);
      missile.y += Math.sin(missile.angle) * (MISSILE_SPEED / TICK_RATE);

      // Check bounds
      if (Math.abs(missile.x) > WORLD_SIZE / 2 || Math.abs(missile.y) > WORLD_SIZE / 2) {
        delete roomState.missiles[id];
        continue;
      }

      // Check collisions with players
      for (const playerId in roomState.players) {
        const player = roomState.players[playerId];
        if (player.id === missile.ownerId || player.state !== 'alive' || player.isInvincible) continue;

        const head = player.segments[0];
        const dx = head.x - missile.x;
        const dy = head.y - missile.y;
        const distSq = dx * dx + dy * dy;

        const scale = 1 + (player.score - INITIAL_LENGTH) * 0.02;
        const hitRadius = 0.8 * scale + 0.5; // head radius + missile radius

        if (distSq < hitRadius * hitRadius) {
          player.state = 'dead';
          delete roomState.missiles[id];
          // Drop orbs
          player.segments.forEach((seg, i) => {
            if (i % 2 === 0) spawnOrbInRoom(roomState, seg.x, seg.y, 1, player.color, true);
          });
          break;
        }
      }
    }

    // Clean up expired portals
    for (const id in roomState.portals) {
      if (now > roomState.portals[id].expiresAt) {
        delete roomState.portals[id];
      }
    }

    // Clean up expired black holes and apply effects
    if (!blackHoleHits[roomId]) blackHoleHits[roomId] = new Set();
    
    for (const id in roomState.blackHoles) {
      const bh = roomState.blackHoles[id];
      if (now > bh.expiresAt) {
        delete roomState.blackHoles[id];
        // Clean up hits for this black hole
        for (const hitKey of Array.from(blackHoleHits[roomId])) {
          if (hitKey.endsWith(`_${id}`)) blackHoleHits[roomId].delete(hitKey);
        }
        continue;
      }

      // Black hole effect: reduce length by 50% (one-time per black hole)
      for (const playerId in roomState.players) {
        const player = roomState.players[playerId];
        if (player.state !== 'alive' || player.isInvincible) continue;

        const hitKey = `${playerId}_${id}`;
        if (blackHoleHits[roomId].has(hitKey)) continue;

        const head = player.segments[0];
        const dx = head.x - bh.x;
        const dy = head.y - bh.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < bh.radius * bh.radius) {
          const newLength = Math.max(INITIAL_LENGTH, Math.floor(player.segments.length * 0.5));
          player.segments = player.segments.slice(0, newLength);
          player.score = Math.floor(player.score * 0.5);
          blackHoleHits[roomId].add(hitKey);
          io.to(playerId).emit('black_hole_hit');
        }
      }
    }

    // Update leaderboard
    roomState.leaderboard = Object.values(roomState.players)
      .filter(p => p.state === 'alive')
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => ({ id: p.id, name: p.name, score: Math.floor(p.score), color: p.color }));

    // Broadcast state to room
    io.to(roomId).emit('state', roomState);
  }
}, 1000 / TICK_RATE);

async function startServer() {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
