/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore, globalGameState } from '../store/gameStore';
import { WORLD_SIZE, TURN_SPEED, BOOST_SPEED, BASE_SPEED, MIN_BOOST_LENGTH, INITIAL_LENGTH, PowerUpType, BLACK_HOLE_RADIUS, PowerUp } from '../shared/types';
import * as THREE from 'three';
import { Sphere, Grid, Torus, Ring } from '@react-three/drei';

const localCollectedOrbs = new Map<string, { x: number, y: number, color: string, time: number }>();

function Snake({ playerId, color, isLocal }: { playerId: string, color: string, isLocal: boolean }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPositions = useRef<{x: number, y: number}[]>([]);

  useFrame((state, delta) => {
    if (!bodyRef.current || !headRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;
    
    const player = gs.players[playerId];
    if (!player || player.segments.length === 0) {
      bodyRef.current.count = 0;
      headRef.current.visible = false;
      return;
    }
    
    headRef.current.visible = true;
    const count = player.segments.length;
    bodyRef.current.count = Math.max(0, count - 1);
    
    // Scale based on score and power-ups
    let scale = 1 + (player.score - INITIAL_LENGTH) * 0.02;
    if (player.isShrunk) scale *= 0.5;
    
    headRef.current.scale.setScalar(scale);
    
    while (currentPositions.current.length < count) {
      const idx = currentPositions.current.length;
      currentPositions.current.push({ 
        x: player.segments[idx]?.x || 0, 
        y: player.segments[idx]?.y || 0 
      });
    }

    for (let i = 0; i < count; i++) {
      let targetX = player.segments[i].x;
      let targetY = player.segments[i].y;
      
      const curr = currentPositions.current[i];
      if (isLocal) {
        curr.x = targetX;
        curr.y = targetY;
      } else {
        const dist = Math.abs(targetX - curr.x) + Math.abs(targetY - curr.y);
        if (dist > 10) {
          curr.x = targetX;
          curr.y = targetY;
        } else {
          const lerpFactor = 15;
          curr.x += (targetX - curr.x) * lerpFactor * delta;
          curr.y += (targetY - curr.y) * lerpFactor * delta;
        }
      }
      
      if (i === 0) {
        headRef.current.position.set(curr.x, curr.y, 0.5);
      } else {
        dummy.position.set(curr.x, curr.y, 0.5);
        // Taper tail slightly
        const segmentScale = scale * (1 - (i / count) * 0.3);
        dummy.scale.setScalar(segmentScale);
        dummy.updateMatrix();
        bodyRef.current.setMatrixAt(i - 1, dummy.matrix);
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
    
    // Visual effect for invincibility
    if (player.isInvincible) {
      const pulse = 1.5 + Math.sin(Date.now() * 0.01) * 0.5;
      headRef.current.scale.multiplyScalar(pulse);
    }
  });

  return (
    <group>
      <Sphere ref={headRef} castShadow receiveShadow args={[0.8, 16, 16]}>
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (0.4 + fresnel * 3.0);
              `
            );
          }}
        />
      </Sphere>
      <instancedMesh ref={bodyRef} args={[null as any, null as any, 2000]} castShadow receiveShadow frustumCulled={false}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (0.4 + fresnel * 1.5);
              `
            );
          }}
        />
      </instancedMesh>
    </group>
  );
}

function PowerUpItem({ pu }: { pu: PowerUp }) {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.set(pu.x, pu.y, 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2);
    meshRef.current.rotation.y += 0.02;
    meshRef.current.rotation.x += 0.01;
    
    let s = 2.25;
    if (pu.type === PowerUpType.SPEED) s = 1.8;
    if (pu.type === PowerUpType.INVINCIBILITY) s = 2.7;
    meshRef.current.scale.setScalar(s * (1 + Math.sin(state.clock.elapsedTime * 10) * 0.1));
  });

  const renderGeometry = () => {
    switch (pu.type) {
      case PowerUpType.MISSILES:
        return (
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.6, 8]} />
              <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={2} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <coneGeometry args={[0.2, 0.4, 8]} />
              <meshStandardMaterial color="red" emissive="red" emissiveIntensity={2} />
            </mesh>
            {/* Fins */}
            <mesh position={[0, -0.4, 0]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.6, 0.1, 0.05]} />
              <meshStandardMaterial color={pu.color} />
            </mesh>
            <mesh position={[0, -0.4, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[0.6, 0.1, 0.05]} />
              <meshStandardMaterial color={pu.color} />
            </mesh>
          </group>
        );
      case PowerUpType.SPEED:
        return (
          <group scale={[0.5, 1, 0.5]}>
            <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 6]}>
              <boxGeometry args={[0.2, 0.8, 0.2]} />
              <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
            </mesh>
            <mesh position={[0.15, -0.1, 0]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.2, 0.8, 0.2]} />
              <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
            </mesh>
            <mesh position={[0.3, -0.5, 0]} rotation={[0, 0, Math.PI / 6]}>
              <boxGeometry args={[0.2, 0.8, 0.2]} />
              <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
            </mesh>
          </group>
        );
      case PowerUpType.PORTAL:
        return (
          <mesh>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshPhysicalMaterial 
              color={pu.color} 
              emissive={pu.color} 
              emissiveIntensity={0.5}
              transmission={0.9}
              thickness={0.5}
              roughness={0.1}
              metalness={0.1}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      case PowerUpType.INVINCIBILITY:
        return (
          <mesh>
             <torusKnotGeometry args={[0.4, 0.1, 64, 8]} />
             <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
          </mesh>
        );
      case PowerUpType.SHRINK_OPPONENTS:
        return (
          <mesh>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
          </mesh>
        );
      case PowerUpType.BLACK_HOLE:
        return (
          <group>
            <mesh>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color="black" emissive="black" />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.7, 0.05, 8, 32]} />
              <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
            </mesh>
          </group>
        );
      default:
        return (
          <mesh>
            <octahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial color={pu.color} emissive={pu.color} emissiveIntensity={4} />
          </mesh>
        );
    }
  };

  return (
    <group ref={meshRef}>
      {renderGeometry()}
    </group>
  );
}

function PowerUps() {
  const [powerUpIds, setPowerUpIds] = useState<string[]>([]);

  useFrame(() => {
    const gs = globalGameState.current;
    if (!gs) return;
    const ids = Object.keys(gs.powerUps);
    if (JSON.stringify(ids) !== JSON.stringify(powerUpIds)) {
      setPowerUpIds(ids);
    }
  });

  const gs = globalGameState.current;
  if (!gs) return null;

  return (
    <group>
      {powerUpIds.map(id => {
        const pu = gs.powerUps[id];
        if (!pu) return null;
        return <PowerUpItem key={id} pu={pu} />;
      })}
    </group>
  );
}

function Missiles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;

    let i = 0;
    for (const id in gs.missiles) {
      const m = gs.missiles[id];
      dummy.position.set(m.x, m.y, 0.5);
      dummy.rotation.z = m.angle;
      dummy.scale.set(3, 1, 1); // Bigger missiles
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      i++;
    }
    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 100]} frustumCulled={false}>
      <coneGeometry args={[0.5, 2, 8]} />
      <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={5} toneMapped={false} />
    </instancedMesh>
  );
}

function Portals() {
  const gs = useGameStore(s => s.gameState);
  const portalRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (portalRef.current) {
      portalRef.current.rotation.z += 0.01;
    }
  });

  if (!gs) return null;

  return (
    <group ref={portalRef}>
      {Object.values(gs.portals).map(p => (
        <group key={p.id}>
          <Torus position={[p.x1, p.y1, 0.1]} args={[1.5, 0.2, 16, 32]}>
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3} toneMapped={false} />
          </Torus>
          <Ring position={[p.x1, p.y1, 0.05]} args={[0, 1.4, 32]}>
            <meshStandardMaterial color="#00ffff" transparent opacity={0.3} />
          </Ring>
          
          <Torus position={[p.x2, p.y2, 0.1]} args={[1.5, 0.2, 16, 32]}>
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3} toneMapped={false} />
          </Torus>
          <Ring position={[p.x2, p.y2, 0.05]} args={[0, 1.4, 32]}>
            <meshStandardMaterial color="#00ffff" transparent opacity={0.3} />
          </Ring>
        </group>
      ))}
    </group>
  );
}

function BlackHoles() {
  const gs = useGameStore(s => s.gameState);
  if (!gs) return null;

  return (
    <>
      {Object.values(gs.blackHoles).map(bh => (
        <group key={bh.id} position={[bh.x, bh.y, 0.1]}>
          <Sphere args={[bh.radius, 32, 32]}>
            <meshStandardMaterial color="#000000" roughness={1} metalness={0} />
          </Sphere>
          {/* Neon Ring */}
          <Torus args={[bh.radius + 0.5, 0.2, 16, 64]}>
            <meshStandardMaterial 
              color="#ff00ff" 
              emissive="#ff00ff" 
              emissiveIntensity={10} 
              toneMapped={false} 
            />
          </Torus>
          {/* Outer Glow Ring */}
          <Ring args={[bh.radius, bh.radius + 2, 64]}>
            <meshStandardMaterial 
              color="#ff00ff" 
              emissive="#ff00ff" 
              emissiveIntensity={2} 
              transparent 
              opacity={0.3} 
              side={THREE.DoubleSide} 
            />
          </Ring>
        </group>
      ))}
    </>
  );
}

function CollectedOrbs({ headPos }: { headPos: { x: number, y: number } | null }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current || !headPos) return;
    const now = Date.now();
    const duration = 400; // ms

    let i = 0;
    localCollectedOrbs.forEach((data, id) => {
      const elapsed = now - data.time;
      if (elapsed > duration) return;

      const t = elapsed / duration;
      // Ease out quad
      const ease = 1 - Math.pow(1 - t, 2);
      
      dummy.position.x = data.x + (headPos.x - data.x) * ease;
      dummy.position.y = data.y + (headPos.y - data.y) * ease;
      dummy.position.z = 0.5;
      
      dummy.scale.setScalar((1 - t) * 0.5);
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      colorObj.set(data.color);
      meshRef.current!.setColorAt(i, colorObj);
      i++;
    });

    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 100]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial 
        transparent 
        opacity={0.8} 
        metalness={0.5} 
        roughness={0.2} 
        toneMapped={false}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * 4.0;
            `
          );
        }}
      />
    </instancedMesh>
  );
}

function Orbs() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;

    let i = 0;
    for (const orbId in gs.orbs) {
      if (localCollectedOrbs.has(orbId)) continue;
      const orb = gs.orbs[orbId];
      dummy.position.set(orb.x, orb.y, 0.5);
      dummy.scale.setScalar(0.5 + Math.sin(Date.now() * 0.005 + i) * 0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorObj.set(orb.color);
      meshRef.current.setColorAt(i, colorObj);
      i++;
    }
    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]} castShadow receiveShadow frustumCulled={false}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.1}
        toneMapped={false}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * 2.5;
            `
          );
        }}
      />
    </instancedMesh>
  );
}

export function GameScene() {
  const { gameState, playerId, sendPlayerState, sendCollectOrb, sendCollectPowerUp, sendFireMissile, sendActivatePortal, socket } = useGameStore();
  const { camera } = useThree();
  const inputs = useRef({ left: false, right: false, boost: false, fire: false, portal: false });
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const [lightTarget] = useState(() => new THREE.Object3D());
  const [localHeadPos, setLocalHeadPos] = useState<{x: number, y: number} | null>(null);
  const lastTeleportTime = useRef<number>(0);

  const localPlayerRef = useRef<{
    active: boolean;
    segments: {x: number, y: number}[];
    score: number;
    currentAngle: number;
    isBoosting: boolean;
    lastSendTime: number;
  }>({
    active: false,
    segments: [],
    score: INITIAL_LENGTH,
    currentAngle: 0,
    isBoosting: false,
    lastSendTime: 0,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inputs.current.left) { inputs.current.left = true; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inputs.current.right) { inputs.current.right = true; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inputs.current.boost) { inputs.current.boost = true; }
      if ((e.key === 'r' || e.key === 'R') && !inputs.current.fire) { 
        inputs.current.fire = true;
        sendFireMissile();
      }
      if ((e.key === 't' || e.key === 'T') && !inputs.current.portal) { 
        inputs.current.portal = true;
        sendActivatePortal();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && inputs.current.left) { inputs.current.left = false; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && inputs.current.right) { inputs.current.right = false; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && inputs.current.boost) { inputs.current.boost = false; }
      if ((e.key === 'r' || e.key === 'R') && inputs.current.fire) { inputs.current.fire = false; }
      if ((e.key === 't' || e.key === 'T') && inputs.current.portal) { inputs.current.portal = false; }
    };

    const handleBlur = () => {
      inputs.current = { left: false, right: false, boost: false, fire: false, portal: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sendFireMissile, sendActivatePortal]);

  useEffect(() => {
    if (!socket) return;
    const handleBlackHoleHit = () => {
      const player = localPlayerRef.current;
      if (player.active) {
        const newLength = Math.max(INITIAL_LENGTH, Math.floor(player.segments.length * 0.5));
        player.segments = player.segments.slice(0, newLength);
        player.score = Math.floor(player.score * 0.5);
      }
    };
    socket.on('black_hole_hit', handleBlackHoleHit);
    return () => {
      socket.off('black_hole_hit', handleBlackHoleHit);
    };
  }, [socket]);

  useFrame((state, delta) => {
    const gs = globalGameState.current;
    if (!gs || !playerId) return;
    
    // Merge mobile inputs from store
    const mobileInputs = useGameStore.getState().inputs;
    const finalInputs = {
      left: inputs.current.left || mobileInputs.left,
      right: inputs.current.right || mobileInputs.right,
      boost: inputs.current.boost || mobileInputs.boost,
    };

    const serverPlayer = gs.players[playerId];
    if (serverPlayer && serverPlayer.state === 'alive') {
      
      // Initialize from server if not active
      if (!localPlayerRef.current.active && serverPlayer.segments.length > 0) {
        localPlayerRef.current.active = true;
        localPlayerRef.current.segments = [...serverPlayer.segments];
        localPlayerRef.current.score = serverPlayer.score;
        localPlayerRef.current.currentAngle = serverPlayer.currentAngle;
      }

      if (!localPlayerRef.current.active) return;

      // Sync from server if score dropped significantly (e.g. black hole hit)
      if (serverPlayer.score < localPlayerRef.current.score * 0.6) {
        localPlayerRef.current.segments = [...serverPlayer.segments];
        localPlayerRef.current.score = serverPlayer.score;
      }

      // Local movement logic
      if (finalInputs.left) localPlayerRef.current.currentAngle += TURN_SPEED * delta;
      if (finalInputs.right) localPlayerRef.current.currentAngle -= TURN_SPEED * delta;
      
      // Boost check: must have at least MIN_BOOST_LENGTH
      localPlayerRef.current.isBoosting = finalInputs.boost && localPlayerRef.current.score > MIN_BOOST_LENGTH;
      
      // Speed scaling: bigger = slower, power-ups = faster
      const lengthScale = 10 / (10 + Math.max(0, localPlayerRef.current.score - INITIAL_LENGTH) * 0.1);
      const speed = (localPlayerRef.current.isBoosting ? BOOST_SPEED : BASE_SPEED) * lengthScale * serverPlayer.speedMultiplier;
      
      const head = { ...localPlayerRef.current.segments[0] };
      head.x += Math.cos(localPlayerRef.current.currentAngle) * speed * delta;
      head.y += Math.sin(localPlayerRef.current.currentAngle) * speed * delta;

    // Portal teleportation
    const now = Date.now();
    if (now - lastTeleportTime.current > 1000) {
        for (const portalId in gs.portals) {
          const p = gs.portals[portalId];
          const d1 = Math.sqrt(Math.pow(head.x - p.x1, 2) + Math.pow(head.y - p.y1, 2));
          const d2 = Math.sqrt(Math.pow(head.x - p.x2, 2) + Math.pow(head.y - p.y2, 2));
          
          if (d1 < 1.5) {
            head.x = p.x2;
            head.y = p.y2;
            lastTeleportTime.current = now;
            break;
          } else if (d2 < 1.5) {
            head.x = p.x1;
            head.y = p.y1;
            lastTeleportTime.current = now;
            break;
          }
        }
      }

      // Update local head pos for animation
      setLocalHeadPos({ x: head.x, y: head.y });

      // Black hole pull effect
      for (const id in gs.blackHoles) {
        const bh = gs.blackHoles[id];
        const dx = bh.x - head.x;
        const dy = bh.y - head.y;
        const distSq = dx * dx + dy * dy;
        const pullRadius = bh.radius * 3;
        if (distSq < pullRadius * pullRadius) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / pullRadius) * 10;
          head.x += (dx / dist) * force * delta;
          head.y += (dy / dist) * force * delta;
        }
      }

      // Boundary check
      const boundary = WORLD_SIZE / 2;
      if (head.x < -boundary) head.x = -boundary;
      if (head.x > boundary) head.x = boundary;
      if (head.y < -boundary) head.y = -boundary;
      if (head.y > boundary) head.y = boundary;

      localPlayerRef.current.segments.unshift(head);

      if (localPlayerRef.current.isBoosting) {
        // Lose length during boost
        localPlayerRef.current.score -= 3 * delta; 
        if (localPlayerRef.current.score <= MIN_BOOST_LENGTH) {
          localPlayerRef.current.isBoosting = false;
          localPlayerRef.current.score = MIN_BOOST_LENGTH;
        }
      }

      const targetLength = Math.floor(localPlayerRef.current.score);
      while (localPlayerRef.current.segments.length > targetLength) {
        localPlayerRef.current.segments.pop();
      }

      // Check orb collisions
      for (const orbId in gs.orbs) {
        if (localCollectedOrbs.has(orbId)) continue;
        const orb = gs.orbs[orbId];
        const dx = head.x - orb.x;
        const dy = head.y - orb.y;
        if (dx * dx + dy * dy < 4) {
          localPlayerRef.current.score += orb.value;
          localCollectedOrbs.set(orbId, { 
            x: orb.x, 
            y: orb.y, 
            color: orb.color, 
            time: Date.now() 
          });
          delete gs.orbs[orbId]; // predict locally
          sendCollectOrb(orbId);
        }
      }

      // Check power-up collisions
      for (const puId in gs.powerUps) {
        const pu = gs.powerUps[puId];
        const dx = head.x - pu.x;
        const dy = head.y - pu.y;
        if (dx * dx + dy * dy < 4) {
          sendCollectPowerUp(puId);
          delete gs.powerUps[puId]; // predict locally
        }
      }

      // Cleanup localCollectedOrbs occasionally
      if (Math.random() < 0.05) {
        const now = Date.now();
        for (const [id, data] of localCollectedOrbs) {
          if (now - data.time > 1000 && !gs.orbs[id]) {
            localCollectedOrbs.delete(id);
          }
        }
      }

      // Check player collisions
      let collided = false;
      if (!serverPlayer.isInvincible) {
        const myScale = (1 + (localPlayerRef.current.score - INITIAL_LENGTH) * 0.02) * (serverPlayer.isShrunk ? 0.5 : 1);
        const myRadius = 0.8 * myScale;

        for (const otherId in gs.players) {
          if (otherId === playerId) continue;
          const other = gs.players[otherId];
          if (other.state !== 'alive') continue;
          
          const otherScale = (1 + (other.score - INITIAL_LENGTH) * 0.02) * (other.isShrunk ? 0.5 : 1);
          const otherRadius = 0.6 * otherScale; // body segment radius

          for (const seg of other.segments) {
            const dx = head.x - seg.x;
            const dy = head.y - seg.y;
            const minDist = myRadius + otherRadius;
            if (dx * dx + dy * dy < minDist * minDist) {
              collided = true;
              break;
            }
          }
          if (collided) break;
        }
      }

      if (collided) {
        localPlayerRef.current.active = false;
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'dead'
        });
        return;
      }

      // Overwrite global state for local rendering
      gs.players[playerId].segments = localPlayerRef.current.segments;
      gs.players[playerId].score = localPlayerRef.current.score;
      gs.players[playerId].currentAngle = localPlayerRef.current.currentAngle;
      gs.players[playerId].isBoosting = localPlayerRef.current.isBoosting;

      // Send state to server at 20Hz
      if (now - localPlayerRef.current.lastSendTime > 50) {
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'alive',
          speedMultiplier: serverPlayer.speedMultiplier
        });
        localPlayerRef.current.lastSendTime = now;
      }

      const targetZ = Math.min(45, Math.max(20, 20 + localPlayerRef.current.score * 0.2));
      
      // Smooth camera follow predicted head
      camera.position.x += (head.x - camera.position.x) * 10 * delta;
      camera.position.y += (head.y - camera.position.y) * 10 * delta;
      camera.position.z += (targetZ - camera.position.z) * 4 * delta;
      camera.lookAt(camera.position.x, camera.position.y, 0);

      // Make the directional light follow the camera to keep shadows crisp
      if (lightRef.current) {
        lightRef.current.position.set(camera.position.x + 10, camera.position.y - 10, 30);
        lightTarget.position.set(camera.position.x, camera.position.y, 0);
      }
    } else {
      localPlayerRef.current.active = false;
    }
  });

  if (!gameState) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        castShadow
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-bias={-0.001}
      />
      <primitive object={lightTarget} />

      {/* Ground plane to receive shadows */}
      <mesh receiveShadow position={[0, 0, -0.2]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      <Grid
        position={[0, 0, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e3a8a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#3b82f6"
        fadeDistance={100}
        fadeStrength={1}
      />

      <Orbs />
      <PowerUps />
      <Missiles />
      <Portals />
      <BlackHoles />
      <CollectedOrbs headPos={localHeadPos} />

      {Object.values(gameState.players).map((player) => {
        if (player.state !== 'alive' || player.segments.length === 0) return null;
        return (
          <Snake
            key={player.id}
            playerId={player.id}
            color={player.color}
            isLocal={player.id === playerId}
          />
        );
      })}
    </>
  );
}
