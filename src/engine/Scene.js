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

  update(dt) {
    if (this.cloudPlane) {
      this.cloudPlane.rotation.z -= 0.05 * dt;
    }
    if (this.dustPoints) {
      const positions = this.dustPoints.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 2 * dt;
        if (positions[i] < 0) {
          positions[i] = 40;
        }
      }
      this.dustPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  initLightingAndEnvironment() {
    // Dynamic Atmospheric Sky & Fog
    this.scene.background = new THREE.Color(0x1e293b);
    this.scene.fog = new THREE.FogExp2(0x1e293b, 0.0035);

    // Sky Hemisphere Shader (24 segments for performance, 3 color gradient)
    const skyGeo = new THREE.SphereGeometry(380, 24, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0284c7) },
        midColor: { value: new THREE.Color(0x6366f1) },
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
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          vec3 color = mix(bottomColor, midColor, smoothstep(0.0, 0.5, t));
          color = mix(color, topColor, smoothstep(0.5, 1.0, t));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);

    // Animated Cloud Layer
    const cloudGeo = new THREE.PlaneGeometry(800, 800);
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 512;
    cloudCanvas.height = 512;
    const ctx = cloudCanvas.getContext('2d');
    for (let i = 0; i < 800; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 30 + 10, 0, Math.PI * 2);
        ctx.fill();
    }
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.wrapT = THREE.RepeatWrapping;
    cloudTex.repeat.set(4, 4);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.cloudPlane = new THREE.Mesh(cloudGeo, cloudMat);
    this.cloudPlane.position.y = 150;
    this.cloudPlane.rotation.x = -Math.PI / 2;
    this.scene.add(this.cloudPlane);

    // Floating particle dust motes
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 800;
    const dustPositions = new Float32Array(dustCount * 3);
    for(let i=0; i<dustCount*3; i+=3) {
      dustPositions[i] = (Math.random() - 0.5) * 300;
      dustPositions[i+1] = Math.random() * 40;
      dustPositions[i+2] = (Math.random() - 0.5) * 300;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.4,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    // Ambient Sky & Bounce Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x334155, 0.85);
    this.scene.add(hemiLight);

    // Directional Sunlight (Casts crisp soft shadows, reduced to 2048 map)
    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    sunLight.position.set(140, 180, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
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

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

    // --- 1. MAIN ROAD GROUND (320m x 320m) ---
    const groundGeo = new THREE.BoxGeometry(320, 2, 320);
    const ground = new THREE.Mesh(groundGeo, roadMat);
    ground.position.set(0, -1, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.colliders.push(ground);

    // Secondary detail ground plane (Cyberpunk grid)
    const gridGeo = new THREE.PlaneGeometry(320, 320);
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 512;
    gridCanvas.height = 512;
    const gctx = gridCanvas.getContext('2d');
    gctx.fillStyle = '#000000';
    gctx.fillRect(0,0,512,512);
    gctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    gctx.lineWidth = 4;
    gctx.beginPath();
    // 320 / 20 = 16 cells, 512 / 16 = 32 pixels per cell
    for(let i=0; i<=512; i+=32) {
      gctx.moveTo(i, 0); gctx.lineTo(i, 512);
      gctx.moveTo(0, i); gctx.lineTo(512, i);
    }
    gctx.stroke();
    const gridTex = new THREE.CanvasTexture(gridCanvas);
    gridTex.wrapS = THREE.RepeatWrapping;
    gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.repeat.set(16, 16);
    const gridMat = new THREE.MeshBasicMaterial({
      map: gridTex,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const gridPlane = new THREE.Mesh(gridGeo, gridMat);
    gridPlane.position.set(0, 0.05, 0);
    gridPlane.rotation.x = -Math.PI / 2;
    this.scene.add(gridPlane);

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

      // Building Enhancements
      // Window glow
      if (Math.random() > 0.3) {
        const winLight = new THREE.PointLight(0x00f0ff, 0.8, 12);
        winLight.position.set(b.x + (Math.random()-0.5)*b.w*1.1, b.h * (0.3 + Math.random()*0.5), b.z + (Math.random()-0.5)*b.d*1.1);
        this.scene.add(winLight);
      }
      
      // Rooftop antenna on tallest buildings
      if (b.h >= 60) {
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 6), antennaMat);
        antenna.position.set(b.x, b.h + 6, b.z);
        this.scene.add(antenna);
      }

      // Ground-level door/entrance cutout
      const doorGeo = new THREE.BoxGeometry(4, 6, 1);
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(b.x, 3, b.z + b.d/2 + 0.1);
      this.scene.add(door);
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

    // MORE STREET PROPS (Instanced)
    const dummy = new THREE.Object3D();

    // 8 parked vehicle shapes
    const carMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4, metalness: 0.6 });
    const carGeo = new THREE.BoxGeometry(4, 2, 8);
    const carPositions = [
      { x: -10, z: -35 }, { x: 10, z: -35 }, { x: -35, z: -10 }, { x: 35, z: -10 },
      { x: -10, z: 35 }, { x: 10, z: 35 }, { x: -35, z: 10 }, { x: 35, z: 10 }
    ];
    const carInstanced = new THREE.InstancedMesh(carGeo, carMat, 8);
    carInstanced.castShadow = true;
    carInstanced.receiveShadow = true;
    let carIdx = 0;
    carPositions.forEach(p => {
      dummy.position.set(p.x, 1, p.z);
      if (Math.abs(p.x) > Math.abs(p.z)) dummy.rotation.y = Math.PI / 2;
      else dummy.rotation.y = 0;
      dummy.updateMatrix();
      carInstanced.setMatrixAt(carIdx++, dummy.matrix);
    });
    this.scene.add(carInstanced);

    // Dumpsters
    const dumpMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
    const dumpGeo = new THREE.BoxGeometry(3, 2.5, 2);
    const dumpPositions = [
      { x: -55, z: -75 }, { x: 55, z: -75 }, { x: -55, z: 75 }, { x: 55, z: 75 }
    ];
    const dumpInstanced = new THREE.InstancedMesh(dumpGeo, dumpMat, 4);
    dumpInstanced.castShadow = true;
    dumpInstanced.receiveShadow = true;
    let dumpIdx = 0;
    dumpPositions.forEach(p => {
      dummy.position.set(p.x, 1.25, p.z);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      dumpInstanced.setMatrixAt(dumpIdx++, dummy.matrix);
    });
    this.scene.add(dumpInstanced);

    // Traffic light poles
    const trafficPoleGeo = new THREE.CylinderGeometry(0.2, 0.2, 8, 6);
    const trafficPositions = [
      { x: -15, z: -15 }, { x: 15, z: -15 }, { x: -15, z: 15 }, { x: 15, z: 15 }
    ];
    const trafficInstanced = new THREE.InstancedMesh(trafficPoleGeo, metalFrameMat, 4);
    trafficInstanced.castShadow = true;
    let trIdx = 0;
    trafficPositions.forEach(p => {
      dummy.position.set(p.x, 4, p.z);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      trafficInstanced.setMatrixAt(trIdx++, dummy.matrix);
    });
    this.scene.add(trafficInstanced);

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

    const coneGeo = new THREE.ConeGeometry(4, 10, 16);
    coneGeo.translate(0, -5, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    streetLampPositions.forEach(lp => {
      // Cylinder segments reduced from 12 to 6 for performance
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 10, 6), metalFrameMat);
      pole.position.set(lp.x, 5, lp.z);
      pole.castShadow = true;
      this.scene.add(pole);
      this.colliders.push(pole);

      // Only add spotlights & cones to inner 4 lamps for performance
      if (Math.abs(lp.x) < 50) {
        const lampLight = new THREE.SpotLight(0xffedd5, 4, 32, Math.PI / 3, 0.5);
        lampLight.position.set(lp.x, 9.8, lp.z);
        lampLight.target.position.set(lp.x, 0, lp.z);
        this.scene.add(lampLight);
        this.scene.add(lampLight.target);

        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(lp.x, 9.8, lp.z);
        this.scene.add(cone);
      }
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
