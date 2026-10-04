// The 3D gift box (React Three Fiber). Loaded lazily: three.js only downloads when the
// opening is shown. Per-frame values live in refs and three.js objects, never React state.

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { MessageLang } from '../languages'
import { drawPhotocard } from './photocard'
import { DURATION, sceneStage, type Stage } from './stages'

/** Her pull on the ribbon, written by the page's pointer handlers */
export type Pull = {
  /** How far, 0..1 */
  amount: number
  /** Which way on screen, as a unit vector (x right, y down) */
  dx: number
  dy: number
}

export type GiftSceneProps = {
  stage: Stage
  pull: MutableRefObject<Pull>
  reduced: boolean
  recipientFirstName: string
  senderName: string
  /** The capsule's language: the photocard is written in it */
  lang: MessageLang
  /** Called once the 3D view is up, so the opening can wait for it */
  onReady?: () => void
}

// Sizes in scene units: the box is 1.2 wide and 1 tall, standing on y = 0.
const BODY_W = 1.2
const BODY_H = 1.0
const LID_W = 1.3
const LID_H = 0.26
const LID_Y = BODY_H + LID_H / 2 - 0.07 // the lid overlaps the body a little
const BAND = 0.2 // ribbon width
const BASE_YAW = -0.55 // turned so two sides show

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const outCubic = (x: number) => 1 - (1 - x) ** 3
const inOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
function outBounce(x: number) {
  const n = 7.5625
  const d = 2.75
  if (x < 1 / d) return n * x * x
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
  return n * (x -= 2.625 / d) * x + 0.984375
}

/** Seconds since the current stage began, and its progress 0..1, read inside useFrame. */
function useStageClock(stage: Stage) {
  const start = useRef(-1)
  useEffect(() => {
    start.current = -1
  }, [stage])
  return (elapsed: number) => {
    if (start.current < 0) start.current = elapsed
    const local = elapsed - start.current
    const ms = DURATION[stage]
    return { local, p: ms ? clamp01((local * 1000) / ms) : 1 }
  }
}

/** Where the camera looks and how much must stay on screen, per stage. */
const FIT: Record<Stage, { cy: number; r: number }> = {
  // The cake is a photo beside the scene: the camera already frames where the box will land
  cake_arrive: { cy: 0.7, r: 1.2 },
  blow: { cy: 0.7, r: 1.2 },
  cake_aside: { cy: 0.7, r: 1.2 },
  arrive: { cy: 0.7, r: 1.2 },
  pull: { cy: 0.7, r: 1.2 },
  untie: { cy: 0.7, r: 1.2 },
  charge: { cy: 0.75, r: 1.2 },
  burst: { cy: 0.9, r: 1.55 },
  rise: { cy: 1.45, r: 1.65 },
  explore: { cy: 1.45, r: 1.65 },
}

/** Wider than this counts as landscape (matches the CSS media query in Reveal3D.css). */
const LANDSCAPE = 1.1
/** In landscape the words take the left; the scene shifts right by this share of the width. */
const SIDE = 0.17
/**
 * Share of the screen height the scene may fill. The rest stays clear for the title,
 * the controls and the pull button, so the box never runs edge to edge.
 */
const USABLE_HEIGHT = 0.62
/** Share of the scene's width it may fill, for a little air at the sides. */
const USABLE_WIDTH = 0.9

/**
 * Keeps a "safe sphere" around the subject on screen at any size and orientation:
 * the camera backs off until the sphere fits the narrower of the two fields of view.
 */
function CameraRig({ stage, reduced }: { stage: Stage; reduced: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const clock = useStageClock(stage)
  const look = useRef(new THREE.Vector3(0, FIT.arrive.cy, 0))
  const want = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(0, 0.3, 1).normalize(), [])
  const landscape = size.width / size.height > LANDSCAPE

  // Landscape: move the picture right (the projection, not the camera) to make room for the words
  useEffect(() => {
    if (landscape) camera.setViewOffset(size.width, size.height, -size.width * SIDE, 0, size.width, size.height)
    else camera.clearViewOffset()
  }, [camera, size, landscape])

  useFrame((state, dt) => {
    const { p } = clock(state.clock.elapsedTime)
    const fit = FIT[stage]
    // Fit only the room the scene really has: less the words' bands in height, and less
    // the words' column in landscape width
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const width = (landscape ? size.width * (1 - 2 * SIDE) : size.width) * USABLE_WIDTH
    const vHalf = Math.atan(tanV * USABLE_HEIGHT)
    const hHalf = Math.atan(tanV * (width / size.height))
    let dist = fit.r / Math.sin(Math.min(vHalf, hHalf))
    if (stage === 'charge' && !reduced) dist *= 1 - 0.15 * p // push in as it builds
    want.set(0, fit.cy, 0).addScaledVector(dir, dist)
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 3.5)
    camera.position.lerp(want, ease)
    look.current.lerp(new THREE.Vector3(0, fit.cy, 0), ease)
    camera.lookAt(look.current)
  })
  return null
}

function Particles({ stage, reduced }: { stage: Stage; reduced: boolean }) {
  const clock = useStageClock(stage)
  const count = 40
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo(() => {
    const data = []
    for (let i = 0; i < count; i++) {
      data.push({
        x: (Math.random() - 0.5) * 2.5,
        y: Math.random() * 2.0,
        z: (Math.random() - 0.5) * 2.5,
        speed: 0.2 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })
    }
    return data
  }, [])

  const geo = useMemo(() => new THREE.SphereGeometry(0.04, 8, 8), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0 }), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const s = sceneStage(stage, reduced)
    if (s === 'cake_arrive' || s === 'blow' || s === 'cake_aside' || s === 'arrive' || s === 'pull' || s === 'untie' || s === 'charge') {
      mesh.current.visible = false
      return
    }
    mesh.current.visible = true
    const { p } = clock(t)
    
    // Fade in during burst/rise
    let opacity = 0
    if (s === 'burst') opacity = p
    else if (s === 'rise') opacity = 1
    else if (s === 'explore') opacity = 0.8 + 0.2 * Math.sin(t * 2)

    mat.opacity = opacity

    particles.forEach((particle, i) => {
      dummy.position.set(
        particle.x + Math.sin(t * particle.speed + particle.phase) * 0.2,
        particle.y + t * particle.speed * 0.5,
        particle.z + Math.cos(t * particle.speed + particle.phase) * 0.2
      )
      // Wrap around Y
      dummy.position.y = (dummy.position.y % 3.0) + 0.5
      dummy.scale.setScalar(0.5 + 0.5 * Math.sin(t * 3 + particle.phase))
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, count]} />
}

function GiftBox({ stage, pull, reduced, recipientFirstName, senderName, lang }: GiftSceneProps) {
  const clock = useStageClock(stage)
  const box = useRef<THREE.Group>(null!)
  const lid = useRef<THREE.Group>(null!)
  const bow = useRef<THREE.Group>(null!)
  const tail = useRef<THREE.Group>(null!)
  const bands = useRef<THREE.Group>(null!)
  const card = useRef<THREE.Group>(null!)
  const shadow = useRef<THREE.Mesh>(null!)
  const glowPlane = useRef<THREE.Mesh>(null!)
  const inner = useRef<THREE.PointLight>(null!)
  const pullNow = useRef<Pull>({ amount: 0, dx: 0, dy: 1 })
  // Scratch objects for aiming the tail (allocated once, reused every frame)
  const aim = useMemo(
    () => ({
      hang: new THREE.Vector3(0, -1, 0), // the tail's own "down"
      dir: new THREE.Vector3(),
      screen: new THREE.Vector3(),
      towardViewer: new THREE.Vector3(),
      parent: new THREE.Quaternion(),
    }),
    [],
  )

  const geo = useMemo(
    () => ({
      body: new RoundedBoxGeometry(BODY_W, BODY_H, BODY_W, 4, 0.05),
      lid: new RoundedBoxGeometry(LID_W, LID_H, LID_W, 4, 0.05),
      bandX: new THREE.BoxGeometry(BAND, BODY_H + 0.004, BODY_W + 0.02),
      bandZ: new THREE.BoxGeometry(BODY_W + 0.02, BODY_H + 0.004, BAND),
      lidBandX: new THREE.BoxGeometry(BAND, LID_H + 0.01, LID_W + 0.02),
      lidBandZ: new THREE.BoxGeometry(LID_W + 0.02, LID_H + 0.01, BAND),
      loop: new THREE.TorusGeometry(0.17, 0.05, 12, 32),
      knot: new THREE.SphereGeometry(0.08, 16, 16),
      tail: new THREE.BoxGeometry(0.11, 1, 0.015).translate(0, -0.5, 0), // hangs from its top edge
      tab: new THREE.SphereGeometry(0.075, 16, 16),
      glow: new THREE.PlaneGeometry(BODY_W - 0.08, BODY_W - 0.08),
      shadow: new THREE.CircleGeometry(0.95, 48),
      card: new THREE.PlaneGeometry(1.0, 1.24),
    }),
    [],
  )
  const mat = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#b8405c', roughness: 0.55, metalness: 0.05 }),
      lid: new THREE.MeshStandardMaterial({ color: '#c94d6a', roughness: 0.5, metalness: 0.05 }),
      ribbon: new THREE.MeshStandardMaterial({ color: '#f2b45a', roughness: 0.32, metalness: 0.35, transparent: true }),
      tab: new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffb648', emissiveIntensity: 2 }),
      glow: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffe2a8').multiplyScalar(3),
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4, depthWrite: false }),
      cardFront: new THREE.MeshBasicMaterial({ color: '#f7f1e6' }),
      cardBack: new THREE.MeshBasicMaterial({ color: '#e9dfca' }),
    }),
    [],
  )

  // The photocard's face: drawn once the handwriting font is ready
  const [cardTexture, setCardTexture] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    let cancelled = false
    let made: THREE.CanvasTexture | null = null
    void drawPhotocard(recipientFirstName, senderName, lang).then((canvas) => {
      if (cancelled) return
      made = new THREE.CanvasTexture(canvas)
      made.colorSpace = THREE.SRGBColorSpace
      made.anisotropy = 4
      setCardTexture(made)
    })
    return () => {
      cancelled = true
      made?.dispose()
    }
  }, [recipientFirstName, senderName, lang])
  useEffect(() => {
    mat.cardFront.map = cardTexture
    mat.cardFront.color.set(cardTexture ? '#ffffff' : '#f7f1e6')
    mat.cardFront.needsUpdate = true
  }, [cardTexture, mat])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const { p } = clock(t)
    const s = sceneStage(stage, reduced)

    // Defaults: the box at rest, closed and tied
    let y = 10 // hide box up high by default
    let yaw = BASE_YAW
    let shakeX = 0
    let shakeZ = 0
    let roll = 0
    let boxScale = 1
    let lidY = LID_Y
    let lidX = 0
    let lidZ = 0
    let lidRotX = 0
    let lidRotZ = 0
    let lidShown = true
    let ribbon = 1
    let bowScale = 1
    let bowLift = 0
    let tailDrop = 0
    let tailTwist = 0
    let glow = 0
    let cardRise = 0

    // Her pull, smoothed so the ribbon follows her finger and springs back when she lets go
    const k = Math.min(1, dt * 12)
    const now = pullNow.current
    now.amount += (pull.current.amount - now.amount) * k
    now.dx += (pull.current.dx - now.dx) * k
    now.dy += (pull.current.dy - now.dy) * k

    // Before 'arrive' (the cake stages) the box stays out of sight above the scene
    switch (s) {
      case 'arrive':
        y = reduced ? 0 : 3.2 * (1 - outBounce(p))
        yaw = BASE_YAW - (reduced ? 0 : 0.6 * (1 - outCubic(p)))
        break
      case 'pull':
        y = reduced ? 0 : 0.03 * Math.sin(t * 2)
        yaw = BASE_YAW + (reduced ? 0 : 0.08 * Math.sin(t * 0.7))
        break
      case 'untie':
        y = 0
        ribbon = 1 - p
        bowScale = 1 - outCubic(p)
        bowLift = 0.4 * p
        tailDrop = 0.7 * p
        tailTwist = 1.2 * p
        break
      case 'charge': {
        y = 0
        ribbon = 0
        const ease = inOutCubic(p)
        lidY = LID_Y + 0.15 * ease
        glow = p * 0.8
        boxScale = 1 + 0.02 * Math.sin(p * Math.PI)
        break
      }
      case 'burst': {
        y = 0
        ribbon = 0
        const lt = p * (DURATION.burst! / 1000 || 0.5)
        lidY = LID_Y + 0.15 + 2 * lt
        lidZ = -0.5 * lt
        lidRotX = -0.5 * lt
        lidRotZ = 0.2 * lt
        glow = 0.8 + 0.2 * p
        boxScale = 1
        break
      }
      case 'rise':
        y = 0
        ribbon = 0
        lidShown = false
        glow = 0.7 - 0.2 * p
        cardRise = p
        break
      case 'explore':
        y = 0
        ribbon = 0
        lidShown = false
        glow = 0.5
        cardRise = 1
        yaw = BASE_YAW + (reduced ? 0 : 0.06 * Math.sin(t * 0.5))
        break
    }

    box.current.position.set(shakeX, y, shakeZ)
    box.current.rotation.set(0, yaw, roll)
    box.current.scale.setScalar(boxScale)
    shadow.current.scale.setScalar(1 / (1 + y * 0.4))
    ;(shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.4 / (1 + y)

    lid.current.visible = lidShown
    lid.current.position.set(lidX, lidY, lidZ)
    lid.current.rotation.set(lidRotX, 0, lidRotZ)

    const tied = ribbon > 0.001
    mat.ribbon.opacity = ribbon
    bands.current.visible = tied
    bow.current.visible = tied
    tail.current.visible = tied
    bow.current.scale.setScalar(Math.max(0.001, bowScale))
    bow.current.position.y = LID_H / 2 + 0.1 + bowLift

    // The tail stretches and points the way she pulls on screen, whatever angle the box is at,
    // then falls away when it comes loose.
    const pullAmount = s === 'pull' ? now.amount : 0
    // Stretches a little as she pulls, less when sideways, so the tab stays on a narrow phone screen
    tail.current.scale.set(1, 0.8 + (0.35 - 0.3 * Math.abs(now.dx)) * pullAmount, 1)
    tail.current.position.set(0.24, LID_H / 2 - 0.02 - tailDrop, LID_W / 2 + 0.012)
    if (pullAmount > 0.001) {
      // Her finger's direction in the world: the camera's right and up, a little toward her
      const cam = state.camera
      aim.screen.set(now.dx, -now.dy, 0).applyQuaternion(cam.quaternion)
      aim.towardViewer.set(0, 0, 1).applyQuaternion(cam.quaternion)
      aim.dir.copy(aim.screen).addScaledVector(aim.towardViewer, 0.35).normalize()
      // Blend from hanging straight down to pointing her way, then express it in the lid's axes
      aim.dir.lerp(aim.hang, 1 - pullAmount).normalize()
      lid.current.getWorldQuaternion(aim.parent)
      aim.dir.applyQuaternion(aim.parent.invert())
      tail.current.quaternion.setFromUnitVectors(aim.hang, aim.dir)
    } else {
      tail.current.rotation.set(0, 0, tailTwist)
    }
    mat.tab.emissiveIntensity = s === 'pull' ? 1.6 + 1.2 * (0.5 + 0.5 * Math.sin(t * 4)) + 2 * pullAmount : 1

    // Light from inside: it leaks while charging, peaks at the burst, then settles
    inner.current.intensity = glow * (s === 'burst' ? 30 : 14)
    mat.glow.opacity = glow
    glowPlane.current.visible = glow > 0.01

    // The photocard rises out of the light and turns to face her
    card.current.visible = cardRise > 0
    const up = outCubic(cardRise)
    card.current.position.set(0, 0.6 + 1.5 * up + (s === 'explore' && !reduced ? 0.04 * Math.sin(t * 1.4) : 0), 0.15)
    card.current.rotation.set(0, Math.PI * (1 - inOutCubic(cardRise)), s === 'explore' && !reduced ? 0.04 * Math.sin(t * 0.9) : 0)
    card.current.scale.setScalar(0.55 + 0.75 * up) // ends at 1.3: the photocard is the hero
  })

  return (
    <>
      <mesh ref={shadow} geometry={geo.shadow} material={mat.shadow} rotation-x={-Math.PI / 2} position-y={0.001} />

      <group ref={box}>
        <mesh geometry={geo.body} material={mat.body} position-y={BODY_H / 2} />
        <group ref={bands} position-y={BODY_H / 2}>
          <mesh geometry={geo.bandX} material={mat.ribbon} />
          <mesh geometry={geo.bandZ} material={mat.ribbon} />
        </group>
        <mesh ref={glowPlane} geometry={geo.glow} material={mat.glow} rotation-x={-Math.PI / 2} position-y={BODY_H + 0.006} />
        <pointLight ref={inner} position={[0, BODY_H + 0.05, 0]} color="#ffcf7a" intensity={0} distance={5} />

        <group ref={lid}>
          <mesh geometry={geo.lid} material={mat.lid} />
          <mesh geometry={geo.lidBandX} material={mat.ribbon} />
          <mesh geometry={geo.lidBandZ} material={mat.ribbon} />
          <group ref={bow}>
            <mesh geometry={geo.loop} material={mat.ribbon} position={[-0.17, 0.06, 0]} rotation={[0, 0.3, 0.5]} scale={[1, 0.7, 1]} />
            <mesh geometry={geo.loop} material={mat.ribbon} position={[0.17, 0.06, 0]} rotation={[0, -0.3, -0.5]} scale={[1, 0.7, 1]} />
            <mesh geometry={geo.knot} material={mat.ribbon} />
          </group>
          <group ref={tail}>
            <mesh geometry={geo.tail} material={mat.ribbon} />
            <mesh geometry={geo.tab} material={mat.tab} position-y={-1} />
          </group>
        </group>
      </group>

      <group ref={card} visible={false}>
        <mesh geometry={geo.card} material={mat.cardFront} />
        <mesh geometry={geo.card} material={mat.cardBack} rotation-y={Math.PI} />
      </group>
    </>
  )
}

export default function GiftScene(props: GiftSceneProps) {
  return (
    <Canvas
      className="r3d-canvas"
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.1, far: 60, position: [0, 2.5, 8] }}
      onCreated={() => props.onReady?.()}
    >
      <ambientLight intensity={0.6} color="#9aa6ff" />
      <directionalLight position={[-3, 5, 4]} intensity={2.4} color="#ffe2b8" />
      <directionalLight position={[3, 2, -4]} intensity={1.3} color="#e88ba0" />
      <GiftBox {...props} />
      <CameraRig stage={props.stage} reduced={props.reduced} />
      <Particles stage={props.stage} reduced={props.reduced} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
      </EffectComposer>
    </Canvas>
  )
}
