/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, Share2, Check, Users, Rocket, Zap, Shield, Minimize, Move, CircleDot, ChevronLeft, ChevronRight, ChevronUp, Maximize2, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PowerUpType } from '../shared/types';

const POWERUP_ICONS: Record<PowerUpType, any> = {
  [PowerUpType.SPEED]: Zap,
  [PowerUpType.INVINCIBILITY]: Shield,
  [PowerUpType.SHRINK_OPPONENTS]: Minimize,
  [PowerUpType.MISSILES]: Rocket,
  [PowerUpType.PORTAL]: Move,
  [PowerUpType.BLACK_HOLE]: CircleDot,
};

const POWERUP_LABELS: Record<PowerUpType, string> = {
  [PowerUpType.SPEED]: 'Speed Boost',
  [PowerUpType.INVINCIBILITY]: 'Invincible',
  [PowerUpType.SHRINK_OPPONENTS]: 'Shrink Opponents',
  [PowerUpType.MISSILES]: 'Missiles',
  [PowerUpType.PORTAL]: 'Portal Created',
  [PowerUpType.BLACK_HOLE]: 'Black Hole Created',
};

export function UI() {
  const { gameState, playerId, joinGame, playerName, setPlayerName, roomId, setRoomId, setInputs, sendFireMissile, sendActivatePortal } = useGameStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, [setRoomId]);

  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 1024);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const player = playerId && gameState ? gameState.players[playerId] : null;
  const isAlive = player?.state === 'alive';
  const isDead = player?.state === 'dead';

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleJoin = () => {
    const finalRoomId = roomId || 'global';
    joinGame(playerName || `Snake-${Math.floor(Math.random() * 1000)}`, finalRoomId);
    
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('room', finalRoomId);
    window.history.pushState({}, '', url);
  };

  const handleInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId || 'global');
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createPrivateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    setRoomId(newRoomId);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto relative">
        <div className="flex flex-col gap-0 z-10">
          <h1 className="text-sm sm:text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
            NEON.SNAKE
          </h1>
          {isAlive && (
            <div className="flex flex-col gap-0 z-10">
              <div className="text-sm sm:text-xl font-mono text-white/80 font-bold">
                {Math.floor(player.score)}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 text-[7px] sm:text-xs font-mono text-white/40">
                <Users size={6} className="sm:w-3 sm:h-3" />
                <span>{roomId}</span>
              </div>
                <div className="flex flex-col gap-0 z-10">
                  {player.missileCount > 0 && (
                    <div className="flex items-center gap-1 sm:gap-2 text-orange-500 font-bold text-[8px] sm:text-sm">
                      <Rocket size={10} className="sm:w-4 sm:h-4" />
                      <span>{player.missileCount}</span>
                    </div>
                  )}
                  {player.portalCount > 0 && (
                    <div className="flex items-center gap-1 sm:gap-2 text-blue-400 font-bold text-[8px] sm:text-sm">
                      <Move size={10} className="sm:w-4 sm:h-4" />
                      <span>{player.portalCount}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        
        {/* Controls Hint */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 flex gap-2 opacity-80 pointer-events-none hidden sm:flex">
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">A</span>
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">D</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Turn</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">SPACE</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Boost</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white text-[10px]">R</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Shoot</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white text-[10px]">T</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Portal</span>
          </div>
        </div>

        <div className="flex gap-1 sm:gap-2 z-10">
          {isAlive && (
            <button
              onClick={handleInvite}
              className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-1 sm:py-2 bg-blue-600 hover:bg-blue-500 backdrop-blur-md rounded-full text-white text-[7px] sm:text-sm font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
            >
              {copied ? <Check size={8} className="sm:w-4 sm:h-4" /> : <Share2 size={8} className="sm:w-4 sm:h-4" />}
              <span>{copied ? 'Copied!' : 'Invite'}</span>
            </button>
          )}
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-1 sm:py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-[7px] sm:text-sm font-bold transition-colors"
          >
            <ExternalLink size={8} className="sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">New Tab</span>
          </button>
        </div>
      </div>

      {/* Active Power-ups */}
      {isAlive && (
        <div className="absolute top-10 sm:top-24 left-4 flex flex-col gap-0.5 sm:gap-2 pointer-events-none">
          {player.isInvincible && (
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-1 sm:gap-2 bg-yellow-500/20 border border-yellow-500/50 px-1 sm:px-3 py-0.5 sm:py-2 rounded-lg backdrop-blur-md">
              <Shield size={6} className="text-yellow-500 sm:w-4 sm:h-4" />
              <span className="text-[6px] sm:text-xs font-bold text-yellow-500 uppercase tracking-wider">Invincible</span>
            </motion.div>
          )}
          {player.speedMultiplier > 1 && (
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-1 sm:gap-2 bg-red-500/20 border border-red-500/50 px-1 sm:px-3 py-0.5 sm:py-2 rounded-lg backdrop-blur-md">
              <Zap size={6} className="text-red-500 sm:w-4 sm:h-4" />
              <span className="text-[6px] sm:text-xs font-bold text-red-500 uppercase tracking-wider">Speed Boost</span>
            </motion.div>
          )}
          {player.isShrunk && (
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-1 sm:gap-2 bg-blue-500/20 border border-blue-500/50 px-1 sm:px-3 py-0.5 sm:py-2 rounded-lg backdrop-blur-md">
              <Minimize size={6} className="text-blue-500 sm:w-4 sm:h-4" />
              <span className="text-[6px] sm:text-xs font-bold text-blue-500 uppercase tracking-wider">Shrunk</span>
            </motion.div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {gameState && gameState.leaderboard.length > 0 && (
        <div className="absolute top-10 sm:top-24 right-4 w-24 sm:w-64 bg-black/40 backdrop-blur-md rounded-lg sm:rounded-2xl p-1 sm:p-4 border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-0.5 sm:gap-2 mb-0.5 sm:mb-4 text-white/80 font-semibold">
            <Trophy size={8} className="text-yellow-400 sm:w-4 sm:h-4" />
            <h2 className="text-[6px] sm:text-sm uppercase tracking-wider">LEADERBOARD</h2>
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-2">
            {gameState.leaderboard.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex justify-between items-center text-[6px] sm:text-sm">
                <div className="flex items-center gap-0.5 sm:gap-2 truncate">
                  <span className="text-white/40 w-1.5 sm:w-4">{i + 1}.</span>
                  <span style={{ color: entry.color }} className="font-medium truncate max-w-[40px] sm:max-w-[120px]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono text-white/80">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orientation Hint */}
      {isPortrait && (
        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 text-center sm:hidden">
          <RotateCw className="text-white animate-spin-slow mb-4" size={48} />
          <h2 className="text-white text-xl font-black uppercase tracking-tighter mb-2">Please Rotate Your Device</h2>
          <p className="text-white/60 text-sm uppercase tracking-widest">This game is best played in landscape mode</p>
          <button 
            onClick={toggleFullscreen}
            className="mt-8 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-widest"
          >
            <Maximize2 size={14} />
            Go Fullscreen
          </button>
        </div>
      )}

      {/* Mobile Controls */}
      {isAlive && (
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex justify-between items-end pointer-events-none sm:hidden">
          {/* Left Side: Steering (Arrows) */}
          <div className="flex flex-col items-center gap-2 pointer-events-auto">
            <button
              onPointerDown={() => setInputs({ boost: true })}
              onPointerUp={() => setInputs({ boost: false })}
              onPointerLeave={() => setInputs({ boost: false })}
              className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center active:bg-white/30 transition-colors shadow-lg"
            >
              <ChevronUp className="text-white" size={24} />
            </button>
            <div className="flex gap-2">
              <button
                onPointerDown={() => setInputs({ left: true })}
                onPointerUp={() => setInputs({ left: false })}
                onPointerLeave={() => setInputs({ left: false })}
                className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center active:bg-white/30 transition-colors shadow-lg"
              >
                <ChevronLeft className="text-white" size={24} />
              </button>
              <button
                onPointerDown={() => setInputs({ right: true })}
                onPointerUp={() => setInputs({ right: false })}
                onPointerLeave={() => setInputs({ right: false })}
                className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center active:bg-white/30 transition-colors shadow-lg"
              >
                <ChevronRight className="text-white" size={24} />
              </button>
            </div>
          </div>

          {/* Right Side: Actions (R, P, B) */}
          <div className="flex flex-col gap-2 items-end pointer-events-auto">
            <div className="flex gap-2">
              <button
                onPointerDown={() => sendActivatePortal()}
                className="w-12 h-12 bg-blue-500/20 backdrop-blur-md rounded-xl border border-blue-500/50 flex items-center justify-center active:bg-blue-500/40 transition-colors font-black text-blue-400 shadow-lg text-lg"
              >
                P
              </button>
              <button
                onPointerDown={() => sendFireMissile()}
                className="w-12 h-12 bg-orange-500/20 backdrop-blur-md rounded-xl border border-orange-500/50 flex items-center justify-center active:bg-orange-500/40 transition-colors font-black text-orange-400 shadow-lg text-lg"
              >
                R
              </button>
            </div>
            <button
              onPointerDown={() => setInputs({ boost: true })}
              onPointerUp={() => setInputs({ boost: false })}
              onPointerLeave={() => setInputs({ boost: false })}
              className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl border border-white/40 flex items-center justify-center active:bg-white/40 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)] font-black text-white text-2xl"
            >
              B
            </button>
          </div>
        </div>
      )}

      {/* Menus */}
      <AnimatePresence>
        {(!player || isDead) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-zinc-900/90 p-5 sm:p-8 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full flex flex-col items-center gap-3 sm:gap-6">
              {isDead && (
                <div className="text-center">
                  <h2 className="text-2xl sm:text-4xl font-black text-red-500 mb-0.5 sm:mb-2">YOU DIED</h2>
                  <p className="text-white/60 text-xs sm:text-sm uppercase tracking-widest">Length: {Math.floor(player.score)}</p>
                </div>
              )}
              
              {!isDead && (
                <div className="text-center">
                  <h2 className="text-xl sm:text-3xl font-black text-white mb-0.5 sm:mb-2 uppercase tracking-tighter">JOIN ARENA</h2>
                  <p className="text-white/60 text-[8px] sm:text-sm uppercase tracking-widest">Steer with A/D or Left/Right. Space to boost.</p>
                </div>
              )}

              <div className="w-full space-y-4">
                <div className="space-y-1 sm:space-y-2">
                  <label className="text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-widest ml-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter name..."
                    maxLength={15}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 sm:py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors text-sm sm:text-base"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between items-end ml-1">
                    <label className="text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-widest">
                      Room ID
                    </label>
                    <button 
                      onClick={createPrivateRoom}
                      className="text-[8px] sm:text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider"
                    >
                      Create Private
                    </button>
                  </div>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="global"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 sm:py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono text-sm sm:text-base"
                  />
                </div>
              </div>
              
              <button
                onClick={handleJoin}
                className="w-full py-2.5 sm:py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors active:scale-95 text-xs sm:text-base"
              >
                {isDead ? 'RESPAWN' : 'PLAY'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
