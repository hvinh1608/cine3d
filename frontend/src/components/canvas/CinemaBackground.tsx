'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate 600 particles randomly dispersed in a 3D volume
  const [positions, colors] = useMemo(() => {
    const count = 250;
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);

    // Cinematic neon color palette (red/purple/blue/cyan)
    const neonColors = [
      new THREE.Color('#ff003c'), // Neon Red
      new THREE.Color('#9d00ff'), // Neon Purple
      new THREE.Color('#0066ff'), // Neon Blue
      new THREE.Color('#00f0ff'), // Neon Cyan
    ];

    let seed = 20260712;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      // Position
      pos[i * 3] = (random() - 0.5) * 15;
      pos[i * 3 + 1] = (random() - 0.5) * 15;
      pos[i * 3 + 2] = (random() - 0.5) * 10;

      // Random color from palette
      const color = neonColors[Math.floor(random() * neonColors.length)];
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    return [pos, cols];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();

    // Rotate points container slowly
    pointsRef.current.rotation.y = time * 0.03;
    pointsRef.current.rotation.x = Math.sin(time * 0.05) * 0.05;

    // Gentle floating wave effect
    const positionsAttr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < positionsAttr.count; i++) {
      const y = positionsAttr.getY(i);
      // Floating upwards, reset if it goes too high
      let newY = y + 0.003;
      if (newY > 7.5) newY = -7.5;
      positionsAttr.setY(i, newY);
    }
    positionsAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function NeonGlowLights() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    // Follow the pointer (mouse) coordinate mapped in 3D
    const { x, y } = state.pointer;
    lightRef.current.position.x = THREE.MathUtils.lerp(lightRef.current.position.x, x * 4, 0.05);
    lightRef.current.position.y = THREE.MathUtils.lerp(lightRef.current.position.y, y * 4, 0.05);
  });

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight
        ref={lightRef}
        position={[0, 0, 2]}
        intensity={1.5}
        distance={8}
        color="#9d00ff"
      />
    </>
  );
}

export default function CinemaBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 hidden h-screen w-screen overflow-hidden bg-[#191a22] lg:block">
      {/* Background radial gradient layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/15 via-[#191a22] to-[#111219] opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-950/10 via-transparent to-transparent opacity-80" />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={1}
        frameloop="always"
        gl={{ antialias: false, powerPreference: 'low-power' }}
      >
        <Particles />
        <NeonGlowLights />
      </Canvas>
    </div>
  );
}
