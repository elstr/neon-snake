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
  INITIAL_LENGTH,
  SEGMENT_SPACING,
  TURN_SPEED,
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

function getOrCreateRoom(roomId: string): GameState {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: {},
      orbs: {},
      leaderboard: [],
    };
    // Initial orbs for new room
    for (let i = 0; i < 150; i++) {
      spawnOrbInRoom(rooms[roomId]);
    }
  }
  return rooms[roomId];
}

function spawnOrbInRoom(roomState: GameState, x?: number, y?: number, value = 1, color?: string, force = false) {
  if (!force && Object.keys(roomState.orbs).length >= MAX_ORBS) return;
  const id = uuidv4();
  roomState.orbs[id] = {
    id,
    x: x ?? (Math.random() - 0.5) * WORLD_SIZE,
    y: y ?? (Math.random() - 0.5) * WORLD_SIZE,
    value,
    color: color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
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
    };

    socket.emit('init', socket.id);
  });

  socket.on('update_state', (data: { segments: any[], score: number, currentAngle: number, isBoosting: boolean, state: string }) => {
    if (!currentRoomId) return;
    const roomState = rooms[currentRoomId];
    if (!roomState) return;

    const player = roomState.players[socket.id];
    if (player && player.state === 'alive') {
      player.segments = data.segments;
      player.score = data.score;
      player.currentAngle = data.currentAngle;
      player.isBoosting = data.isBoosting;
      
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
      spawnOrbInRoom(roomState);
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
