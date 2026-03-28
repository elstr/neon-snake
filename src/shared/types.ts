/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type GameState = {
  players: Record<string, Player>;
  orbs: Record<string, Orb>;
  powerUps: Record<string, PowerUp>;
  missiles: Record<string, Missile>;
  portals: Record<string, Portal>;
  blackHoles: Record<string, BlackHole>;
  leaderboard: LeaderboardEntry[];
};

export type PlayerState = 'alive' | 'dead' | 'spectating';

export type Player = {
  id: string;
  name: string;
  color: string;
  segments: { x: number; y: number }[];
  score: number;
  isBoosting: boolean;
  state: PlayerState;
  currentAngle: number;
  inputs: { left: boolean; right: boolean; boost: boolean };
  // Power-up states
  isInvincible: boolean;
  isShrunk: boolean;
  missileCount: number;
  portalCount: number;
  speedMultiplier: number;
};

export type Orb = {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
};

export enum PowerUpType {
  SPEED = 'speed',
  INVINCIBILITY = 'invincibility',
  SHRINK_OPPONENTS = 'shrink_opponents',
  MISSILES = 'missiles',
  PORTAL = 'portal',
  BLACK_HOLE = 'black_hole',
}

export type PowerUp = {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  color: string;
};

export type Missile = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  angle: number;
};

export type Portal = {
  id: string;
  ownerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  expiresAt: number;
};

export type BlackHole = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  color: string;
};

export const WORLD_SIZE = 300;
export const BASE_SPEED = 15;
export const BOOST_SPEED = 30;
export const TICK_RATE = 60; // 60 updates per second
export const ORB_SPAWN_RATE = 0.1; // Orbs per tick
export const MAX_ORBS = 300;
export const MAX_POWERUPS = 100;
export const INITIAL_LENGTH = 10;
export const MIN_BOOST_LENGTH = 5;
export const SEGMENT_SPACING = 0.5;
export const TURN_SPEED = Math.PI * 3; // Radians per second

export const POWERUP_DURATION = 5000; // 5 seconds
export const MISSILE_SPEED = 40;
export const MISSILE_LIFE = 2000; // 2 seconds
export const PORTAL_LIFE = 15000; // 15 seconds
export const BLACK_HOLE_LIFE = 10000; // 10 seconds
export const BLACK_HOLE_RADIUS = 5;
