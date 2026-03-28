/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, Player } from '../shared/types';

interface GameStore {
  socket: Socket | null;
  gameState: GameState | null;
  playerId: string | null;
  playerName: string;
  roomId: string;
  setPlayerName: (name: string) => void;
  setRoomId: (id: string) => void;
  connect: () => void;
  joinGame: (name: string, roomId: string) => void;
  sendPlayerState: (data: any) => void;
  sendCollectOrb: (orbId: string) => void;
  sendCollectPowerUp: (powerUpId: string) => void;
  sendFireMissile: () => void;
  sendActivatePortal: () => void;
  inputs: { left: boolean; right: boolean; boost: boolean };
  setInputs: (inputs: Partial<{ left: boolean; right: boolean; boost: boolean }>) => void;
}

export const globalGameState: { current: GameState | null } = { current: null };
let lastUiUpdate = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  gameState: null,
  playerId: null,
  playerName: '',
  roomId: 'global',
  setPlayerName: (name) => set({ playerName: name }),
  setRoomId: (id) => set({ roomId: id }),
  connect: () => {
    if (get().socket) return;
    
    const socket = io();

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('init', (id: string) => {
      set({ playerId: id });
    });

    socket.on('state', (state: GameState) => {
      globalGameState.current = state;
      const now = Date.now();
      if (now - lastUiUpdate > 100) { // Throttle React updates to 10Hz
        set({ gameState: state });
        lastUiUpdate = now;
      }
    });

    set({ socket });
  },
  joinGame: (name, roomId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('join', { name, roomId });
    }
  },
  sendPlayerState: (data) => {
    const { socket } = get();
    if (socket) {
      socket.emit('update_state', data);
    }
  },
  sendCollectOrb: (orbId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('collect_orb', orbId);
    }
  },
  sendCollectPowerUp: (powerUpId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('collect_powerup', powerUpId);
    }
  },
  sendFireMissile: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('fire_missile');
    }
  },
  sendActivatePortal: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('activate_portal');
    }
  },
  inputs: { left: false, right: false, boost: false },
  setInputs: (newInputs) => set((state) => ({ 
    inputs: { ...state.inputs, ...newInputs } 
  })),
}));
