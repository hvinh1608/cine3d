'use client';

import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import type { Movie } from '../../types/movie';

function Poster({ movie, position, rotation }: { movie: Movie; position: [number, number, number]; rotation: [number, number, number] }) {
  return <group position={position} rotation={rotation}>
    <mesh position={[0, 0, -0.04]} castShadow>
      <boxGeometry args={[2.05, 3.05, 0.12]} />
      <meshStandardMaterial color="#111827" metalness={0.65} roughness={0.28} />
    </mesh>
    <Html transform distanceFactor={2.35} position={[0, 0, 0.04]} className="pointer-events-auto select-none">
      <Link href={`/movies/${movie.slug}`} aria-label={`Xem ${movie.title}`} className="group block w-[180px] overflow-hidden rounded-md border border-amber-300/40 bg-slate-950 shadow-2xl transition hover:-translate-y-1 hover:border-amber-300">
        <div className="relative aspect-[2/3] overflow-hidden"><Image src={movie.posterUrl} alt={movie.title} fill sizes="180px" className="object-cover transition duration-500 group-hover:scale-105" /></div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-3 pt-12">
          <p className="line-clamp-2 text-xs font-black text-white">{movie.title}</p>
          <p className="mt-1 text-[9px] font-bold text-amber-300">{movie.releaseYear} · {movie.quality || 'HD'}</p>
        </div>
      </Link>
    </Html>
    <pointLight position={[0, 1.9, 0.8]} color="#fbbf24" intensity={2.2} distance={4} />
  </group>;
}

function Theater({ movies }: { movies: Movie[] }) {
  const slots = useMemo(() => [
    { position: [-4.6, 1.7, -4.65], rotation: [0, 0, 0] },
    { position: [-1.55, 1.7, -4.65], rotation: [0, 0, 0] },
    { position: [1.55, 1.7, -4.65], rotation: [0, 0, 0] },
    { position: [4.6, 1.7, -4.65], rotation: [0, 0, 0] },
    { position: [-6.35, 1.7, -1.4], rotation: [0, Math.PI / 2, 0] },
    { position: [6.35, 1.7, -1.4], rotation: [0, -Math.PI / 2, 0] },
  ] as const, []);
  return <>
    <color attach="background" args={['#02030a']} />
    <fog attach="fog" args={['#02030a', 8, 21]} />
    <ambientLight intensity={0.45} color="#64748b" />
    <spotLight position={[0, 7, 3]} angle={0.8} penumbra={0.8} intensity={15} color="#8b5cf6" castShadow />
    <Stars radius={25} depth={12} count={700} factor={2} saturation={0.3} fade speed={0.35} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[18, 18]} /><meshStandardMaterial color="#080b14" roughness={0.7} metalness={0.25} /></mesh>
    <mesh position={[0, 3, -4.9]} receiveShadow><boxGeometry args={[13.8, 6, 0.25]} /><meshStandardMaterial color="#090b12" roughness={0.85} /></mesh>
    <mesh position={[-6.55, 3, 0]} receiveShadow><boxGeometry args={[0.25, 6, 10]} /><meshStandardMaterial color="#070910" /></mesh>
    <mesh position={[6.55, 3, 0]} receiveShadow><boxGeometry args={[0.25, 6, 10]} /><meshStandardMaterial color="#070910" /></mesh>
    {movies.slice(0, slots.length).map((movie, index) => <Poster key={movie.id} movie={movie} position={[...slots[index].position]} rotation={[...slots[index].rotation]} />)}
    {[-4.5, -1.5, 1.5, 4.5].map((x) => <mesh key={x} position={[x, 0.08, 1.8]}><boxGeometry args={[1.8, 0.16, 3.4]} /><meshStandardMaterial color="#5b1021" roughness={0.75} /></mesh>)}
  </>;
}

export default function CinemaLobby({ movies }: { movies: Movie[] }) {
  return <div className="relative h-[72vh] min-h-[540px] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_40px_120px_rgba(0,0,0,.65)]">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.1, 8.7], fov: 52 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <Suspense fallback={null}><Theater movies={movies} /></Suspense>
      <OrbitControls target={[0, 1.8, -1.8]} enablePan={false} minDistance={6} maxDistance={12} minPolarAngle={Math.PI / 3.6} maxPolarAngle={Math.PI / 2.05} minAzimuthAngle={-0.85} maxAzimuthAngle={0.85} />
    </Canvas>
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-5 md:p-7">
      <div><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">Virtual experience</p><h1 className="mt-2 text-2xl font-black md:text-4xl">Sảnh điện ảnh CINE3D</h1><p className="mt-2 max-w-lg text-xs text-slate-400 md:text-sm">Kéo để nhìn quanh · cuộn để tiến gần · chọn poster để mở phim</p></div>
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-300">3D LIVE</span>
    </div>
  </div>;
}
