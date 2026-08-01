import * as THREE from 'three';
import { TextureGen } from './TextureGen.js';

export class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.colliders = [];
    this.jumpPads = [];

    this.initLightingAndEnvironment();
    this.buildMegaCityMap();
  }

  initLightingAndEnvironment() {
    // Dynamic Atmospheric Sky & Fog
    this.scene.background = new THREE.Color(0x1e293b);
    this.scene.fog = new THREE.FogExp2(0x1e293b, 0.0035);

    // Sky Hemisphere Shader
    const skyGeo = new THREE.SphereGeometry(380, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0284c7) },
        bottomColor: { value: new THREE.Color(0xfba518) },
        offset: { value: 25 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);

    // Ambient Sky & Bounce Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x334155, 0.85);
    this.scene.add(hemiLight);

    // Directional Sunlight (Casts crisp soft shadows)
    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    sunLight.position.set(140, 180, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 450;
    const d = 180;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0002;
    this.scene.add(sunLight);
  }

  buildMegaCityMap() {
    // --- PROCEDURAL CANVAS TEXTURES ---
    const roadTexture = TextureGen.createRoadTexture();
    roadTexture.repeat.set(18, 18);

    const bldTextureA = TextureGen.createBuildingTexture('#334155', '#38bdf8');
    bldTextureA.repeat.set(3, 6);

    const bldTextureB = TextureGen.createBuildingTexture('#1e293b', '#f59e0b');
    bldTextureB.repeat.set(3, 7);

    const containerRedTex = TextureGen.createContainerTexture('#dc2626');
    const containerBlueTex = TextureGen.createContainerTexture('#2563eb');
    const containerYellowTex = TextureGen.createContainerTexture('#d97706');
    const containerGreenTex = TextureGen.createContainerTexture('#059669');

    // Materials
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.6, metalness: 0.2 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.2 });

    const buildingMatA = new THREE.MeshStandardMaterial({ map: bldTextureA, roughness: 0.4, metalness: 0.6 });
    const buildingMatB = new THREE.MeshStandardMaterial({ map: bldTextureB, roughness: 0.3, metalness: 0.7 });

    const metalFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.9 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
    const woodTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

    const jumpPadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    // --- 1. MAIN ROAD GROUND (320m x 320m) ---
    const groundGeo = new THREE.BoxGeometry(320, 2, 320);
    const ground = new THREE.Mesh(groundGeo, roadMat);
    ground.position.set(0, -1, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.colliders.push(ground);

    // --- 2. SIDEWALKS & ELEVATED PEDESTRIAN BLOCKS ---
    const sidewalkBlocks = [
      { x: -55, z: -85, w: 80, h: 0.5, d: 80 },
      { x: 55, z: -85, w: 80, h: 0.5, d: 80 },
      { x: -55, z: 85, w: 80, h: 0.5, d: 80 },
      { x: 55, z: 85, w: 80, h: 0.5, d: 80 },
      { x: 0, z: 0, w: 90, h: 0.5, d: 90 } // Central Plaza
    ];

    sidewalkBlocks.forEach(s => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), sidewalkMat);
      mesh.position.set(s.x, s.h / 2, s.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });

    // --- 3. CITY SKYSCRAPERS & COMPLEX STRUCTURES ---
    const cityBuildings = [
      // North Block
      { x: -60, z: -90, w: 36, h: 52, d: 36, mat: buildingMatA },
      { x: -15, z: -95, w: 40, h: 65, d: 40, mat: buildingMatB },
      { x: 30, z: -95, w: 40, h: 56, d: 40, mat: buildingMatA },
      { x: 65, z: -90, w: 36, h: 48, d: 36, mat: buildingMatB },

      // South Block
      { x: -60, z: 90, w: 36, h: 55, d: 36, mat: buildingMatB },
      { x: 0, z: 95, w: 48, h: 70, d: 42, mat: buildingMatA },
      { x: 60, z: 90, w: 36, h: 50, d: 36, mat: buildingMatB },

      // West & East Wings
      { x: -105, z: 0, w: 42, h: 60, d: 65, mat: buildingMatA },
      { x: 105, z: 0, w: 42, h: 62, d: 65, mat: buildingMatB },

      // Central Plaza Surrounding Structures (Accessible Balconies)
      { x: -38, z: 0, w: 24, h: 14, d: 30, mat: buildingMatA },
      { x: 38, z: 0, w: 24, h: 14, d: 30, mat: buildingMatA }
    ];

    cityBuildings.forEach(b => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh); // Add to colliders array so players CANNOT walk through buildings!

      // Roof Edge Neon Band
      const trimGeo = new THREE.BoxGeometry(b.w + 0.4, 0.8, b.d + 0.4);
      const trimMat = Math.random() > 0.5 ? neonCyanMat : neonPinkMat;
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(b.x, b.h - 0.4, b.z);
      this.scene.add(trim);
    });

    // --- 4. SKYBRIDGES & HIGH WALKWAYS ---
    const bridge1 = new THREE.Mesh(new THREE.BoxGeometry(52, 1.2, 7.5), metalFrameMat);
    bridge1.position.set(0, 14, 0);
    bridge1.castShadow = true;
    bridge1.receiveShadow = true;
    this.scene.add(bridge1);
    this.colliders.push(bridge1);

    // Bridge Railings
    const railA = new THREE.Mesh(new THREE.BoxGeometry(52, 1.4, 0.3), metalFrameMat);
    railA.position.set(0, 15.2, 3.6);
    this.scene.add(railA);
    this.colliders.push(railA);

    const railB = new THREE.Mesh(new THREE.BoxGeometry(52, 1.4, 0.3), metalFrameMat);
    railB.position.set(0, 15.2, -3.6);
    this.scene.add(railB);
    this.colliders.push(railB);

    // Stairs / Ramps up to Skybridge
    this.createRamp(-16, 7, 0, 5.5, 14, 26, 0);
    this.createRamp(16, 7, 0, 5.5, 14, 26, 0);

    // --- 5. CORRUGATED SHIPPING CONTAINERS ---
    const containers = [
      { x: -38, y: 2.5, z: -38, rot: 0, tex: containerRedTex },
      { x: -38, y: 7.5, z: -38, rot: 0.1, tex: containerRedTex }, // Stacked!
      { x: 38, y: 2.5, z: -38, rot: 0.4, tex: containerBlueTex },
      { x: 38, y: 7.5, z: -38, rot: 0.4, tex: containerBlueTex }, // Stacked!
      { x: -52, y: 2.5, z: 28, rot: -0.5, tex: containerYellowTex },
      { x: 52, y: 2.5, z: 28, rot: 0.3, tex: containerGreenTex },
      { x: 0, y: 2.5, z: 48, rot: Math.PI / 2, tex: containerRedTex }
    ];

    containers.forEach(c => {
      const mat = new THREE.MeshStandardMaterial({ map: c.tex, roughness: 0.4, metalness: 0.6 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(6.5, 5, 14.5), mat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.rotation.y = c.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh); // Container collision added!
    });

    // --- 6. URBAN PARK TREES & PROPS ---
    const treePositions = [
      { x: -25, z: -20 }, { x: 25, z: -20 },
      { x: -25, z: 20 },  { x: 25, z: 20 }
    ];

    treePositions.forEach(tp => {
      // Trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 5, 8), woodTrunkMat);
      trunk.position.set(tp.x, 2.5, tp.z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      this.colliders.push(trunk);

      // Foliage Top
      const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(3), foliageMat);
      leaves.position.set(tp.x, 6, tp.z);
      leaves.castShadow = true;
      this.scene.add(leaves);
    });

    // Concrete Cover Barriers
    const streetBarriers = [
      { x: -8, z: -18, sx: 9, sy: 2.4, sz: 1.4 },
      { x: 8, z: -18, sx: 9, sy: 2.4, sz: 1.4 },
      { x: -28, z: 28, sx: 1.4, sy: 2.4, sz: 9 },
      { x: 28, z: 28, sx: 1.4, sy: 2.4, sz: 9 },
      { x: -42, z: -52, sx: 11, sy: 2.4, sz: 1.4 },
      { x: 42, z: -52, sx: 11, sy: 2.4, sz: 1.4 }
    ];

    streetBarriers.forEach(b => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.sx, b.sy, b.sz), concreteMat);
      mesh.position.set(b.x, b.y / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);
    });

    // --- 7. CENTRAL PLAZA HOLOGRAM MONUMENT ---
    const monBase = new THREE.Mesh(new THREE.BoxGeometry(16, 2.8, 16), metalFrameMat);
    monBase.position.set(0, 1.4, 38);
    monBase.castShadow = true;
    monBase.receiveShadow = true;
    this.scene.add(monBase);
    this.colliders.push(monBase);

    const monPillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 12, 16), neonCyanMat);
    monPillar.position.set(0, 8.5, 38);
    this.scene.add(monPillar);

    const monLight = new THREE.PointLight(0x00f0ff, 3, 28);
    monLight.position.set(0, 8.5, 38);
    this.scene.add(monLight);

    // --- 8. STREETLAMPS WITH SPOTLIGHT CONES ---
    const streetLampPositions = [
      { x: -28, z: -28 }, { x: 28, z: -28 },
      { x: -28, z: 28 },  { x: 28, z: 28 },
      { x: -68, z: -68 }, { x: 68, z: -68 },
      { x: -68, z: 68 },  { x: 68, z: 68 }
    ];

    streetLampPositions.forEach(lp => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 10, 12), metalFrameMat);
      pole.position.set(lp.x, 5, lp.z);
      pole.castShadow = true;
      this.scene.add(pole);
      this.colliders.push(pole);

      const lampLight = new THREE.SpotLight(0xffedd5, 4, 32, Math.PI / 3, 0.5);
      lampLight.position.set(lp.x, 9.8, lp.z);
      lampLight.target.position.set(lp.x, 0, lp.z);
      this.scene.add(lampLight);
      this.scene.add(lampLight.target);
    });

    // --- 9. JUMP PADS (Launch to Skybridge) ---
    const padPositions = [
      { x: -38, z: -28 },
      { x: 38, z: -28 },
      { x: -38, z: 28 },
      { x: 38, z: 28 },
      { x: 0, z: -65 },
      { x: 0, z: 65 }
    ];

    padPositions.forEach(p => {
      const padGeo = new THREE.CylinderGeometry(2.5, 3.2, 0.4, 16);
      const padMesh = new THREE.Mesh(padGeo, jumpPadMat);
      padMesh.position.set(p.x, 0.2, p.z);
      this.scene.add(padMesh);
      this.jumpPads.push(padMesh);

      const light = new THREE.PointLight(0x10b981, 2, 15);
      light.position.set(p.x, 2, p.z);
      this.scene.add(light);
    });
  }

  createRamp(x, y, z, width, height, length, rotationY) {
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });
    const rampGeo = new THREE.BoxGeometry(width, height, length);
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(x, y, z);
    ramp.rotation.y = rotationY;
    ramp.rotation.x = Math.atan2(height, length);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.scene.add(ramp);
    this.colliders.push(ramp);
  }
}
