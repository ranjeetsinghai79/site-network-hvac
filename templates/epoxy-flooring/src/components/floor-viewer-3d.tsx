"use client"

import { Suspense, useRef, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { MeshReflectorMaterial, MeshTransmissionMaterial, Environment, Lightformer } from "@react-three/drei"
import * as THREE from "three"

interface Props {
  /** "r,g,b" 0-255 tint of the active finish, drives floor + resin color */
  tint: string
  reduced: boolean
}

function tintToColor(tint: string) {
  const [r, g, b] = tint.split(",").map((n) => parseInt(n, 10) / 255)
  return new THREE.Color(r, g, b)
}

function ReflectiveFloor({ tint }: { tint: string }) {
  const color = useMemo(() => tintToColor(tint), [tint])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <planeGeometry args={[14, 14]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={6}
        mixStrength={2}
        roughness={0.4}
        depthScale={0.6}
        minDepthThreshold={0.85}
        color={color}
        metalness={0.4}
        mirror={0.75}
      />
    </mesh>
  )
}

function ResinDrop({ tint }: { tint: string }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = useMemo(() => tintToColor(tint), [tint])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.25
    meshRef.current.rotation.x += delta * 0.08
  })

  return (
    <mesh ref={meshRef} position={[0, 0.55, 0]}>
      <icosahedronGeometry args={[1.1, 8]} />
      <MeshTransmissionMaterial
        color={color}
        thickness={1.1}
        roughness={0.04}
        transmission={1}
        ior={1.35}
        chromaticAberration={0.03}
        anisotropy={0.2}
        distortion={0.12}
        distortionScale={0.25}
        temporalDistortion={0.08}
        clearcoat={1}
        resolution={512}
      />
    </mesh>
  )
}

/** Baked once (frames=1) to an offscreen cubemap — these lightformer panels are never drawn
 *  into the visible scene, they only exist as reflections/refractions for the floor + resin
 *  drop to pick up. Standard drei "studio softbox" recipe. No external HDRI fetch. */
function StudioLighting({ tint }: { tint: string }) {
  const [r, g, b] = tint.split(",").map((n) => parseInt(n, 10))
  const accent = `rgb(${r},${g},${b})`
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={3} color="#ffffff" position={[0, 5, -4]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 5, 1]} />
      <Lightformer intensity={2} color={accent} position={[-6, 2, 2]} rotation={[0, Math.PI / 2.5, 0]} scale={[5, 8, 1]} />
      <Lightformer intensity={2} color="#ffffff" position={[6, 2, 2]} rotation={[0, -Math.PI / 2.5, 0]} scale={[5, 8, 1]} />
      <Lightformer intensity={1.2} color="#ffffff" position={[0, -3, 3]} rotation={[-Math.PI / 2, 0, 0]} scale={[8, 8, 1]} />
    </Environment>
  )
}

function CameraRig() {
  const { camera, pointer } = useThree()
  useFrame(() => {
    camera.position.x += (pointer.x * 1.4 - camera.position.x) * 0.04
    camera.position.y += (2.1 - pointer.y * 0.6 - camera.position.y) * 0.04
    camera.lookAt(0, 0.2, 0)
  })
  return null
}

function Scene({ tint, reduced }: Props) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} />
      <StudioLighting tint={tint} />
      <ResinDrop tint={tint} />
      <ReflectiveFloor tint={tint} />
      {!reduced && <CameraRig />}
    </>
  )
}

export function FloorViewer3D({ tint }: { tint: string }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <div className="relative w-full h-[380px] md:h-[440px] rounded-2xl overflow-hidden" style={{ background: "var(--brand-bg-mid)" }}>
      <Canvas
        camera={{ position: [0, 2, 6], fov: 40 }}
        dpr={[1, 1.75]}
        frameloop={reduced ? "demand" : "always"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene tint={tint} reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  )
}
