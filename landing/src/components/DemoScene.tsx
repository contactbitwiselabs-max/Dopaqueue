"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

// ── Wireframe Dodecahedron ──
function WireframeGeo() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.2;
    // Tilt toward cursor
    meshRef.current.rotation.z = THREE.MathUtils.lerp(
      meshRef.current.rotation.z,
      pointer.x * 0.3,
      0.05
    );
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      meshRef.current.rotation.x + pointer.y * 0.1,
      0.02
    );
  });

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[1.8, 0]} />
        <meshBasicMaterial
          color="#a3e635"
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      {/* Inner glow sphere */}
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial
          color="#a3e635"
          transparent
          opacity={0.03}
        />
      </mesh>
    </Float>
  );
}

// ── Floating Particles ──
function Particles({ count = 800 }) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 3;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.03;
    pointsRef.current.rotation.x += delta * 0.01;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#a3e635"
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
}

// ── Ambient Rings ──
function Rings() {
  const ringRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z += delta * 0.05;
  });

  return (
    <group ref={ringRef}>
      {[2.8, 3.4, 4.0].map((radius, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.2, i * 0.1, 0]}>
          <torusGeometry args={[radius, 0.005, 16, 100]} />
          <meshBasicMaterial
            color="#a3e635"
            transparent
            opacity={0.08 - i * 0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Exported Scene ──
export function DemoScene({ className = "" }: { className?: string }) {
  return (
    <div className={`${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.4} color="#a3e635" />
        <WireframeGeo />
        <Particles />
        <Rings />
        {/* Subtle fog */}
        <fog attach="fog" args={["#0a0a08", 5, 12]} />
      </Canvas>
    </div>
  );
}
