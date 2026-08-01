import * as THREE from 'three';

export class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.colliders = [];
    this.jumpPads = [];
    this.interactiveObjects = [];

    this.initLightingAndEnvironment();
    this.buildMegaCityMap();
  }

  initLightingAndEnvironment() {
    // Cyberpunk Sunset / Night Sky
    this.scene.background = new THREE.Color(0x0a0e1a);
    this.scene.fog = new THREE.FogExp2(0x0a0e1a, 0.005); // Deep distance fog

    // Ambient Sky & Ground light
    const ambientLight = new THREE.AmbientLight(0x64748b, 0.6);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    this.scene.add(hemiLight);

    // Directional Sunset Sunlight (Casts long dramatic shadows across the city)
    const sunLight = new THREE.DirectionalLight(0xfba518, 1.5);
    sunLight.position.set(120, 150, 90);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 350;
    const d = 160;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);
  }

  buildMegaCityMap() {
    // --- MATERIALS ---
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.2 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7, metalness: 0.1 });
    const buildingMatA = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.7 });
    const buildingMatB = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 });

    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const neonYellowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const jumpPadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    // --- 1. MAIN CITY ASPHALT GROUND (300m x 300m) ---
    const groundGeo = new THREE.BoxGeometry(320, 2, 320);
    const ground = new THREE.Mesh(groundGeo, roadMat);
    ground.position.set(0, -1, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.colliders.push(ground);

    // City Road Grid Lines
    const grid = new THREE.GridHelper(320, 40, 0x00f0ff, 0x1e293b);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // --- 2. PERIMETER MEGA SKYSCRAPERS (Out of bounds city backdrop) ---
    const arenaLimit = 320;
    const boundaryWallHeight = 35;
    const wallGeoH = new THREE.BoxGeometry(arenaLimit, boundaryWallHeight, 4);
    const wallGeoV = new THREE.BoxGeometry(4, boundaryWallHeight, arenaLimit);

    const bWalls = [
      { geo: wallGeoH, pos: [0, boundaryWallHeight / 2, -arenaLimit / 2] },
      { geo: wallGeoH, pos: [0, boundaryWallHeight / 2, arenaLimit / 2] },
      { geo: wallGeoV, pos: [arenaLimit / 2, boundaryWallHeight / 2, 0] },
      { geo: wallGeoV, pos: [-arenaLimit / 2, boundaryWallHeight / 2, 0] }
    ];

    bWalls.forEach(w => {
      const mesh = new THREE.Mesh(w.geo, buildingMatB);
      mesh.position.set(...w.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);
    });

    // --- 3. CITY DISTRICT BUILDINGS & SKYSCRAPERS ---
    const cityBuildings = [
      // Central North Block
      { x: -50, z: -80, w: 30, h: 40, d: 30, mat: buildingMatA },
      { x: 0, z: -90, w: 40, h: 55, d: 35, mat: buildingMatB },
      { x: 50, z: -80, w: 30, h: 45, d: 30, mat: buildingMatA },

      // Central South Block
      { x: -50, z: 80, w: 30, h: 45, d: 30, mat: buildingMatA },
      { x: 0, z: 90, w: 40, h: 50, d: 35, mat: buildingMatB },
      { x: 50, z: 80, w: 30, h: 40, d: 30, mat: buildingMatA },

      // West District
      { x: -90, z: -30, w: 35, h: 48, d: 40, mat: buildingMatB },
      { x: -90, z: 30, w: 35, h: 52, d: 40, mat: buildingMatA },

      // East District
      { x: 90, z: -30, w: 35, h: 50, d: 40, mat: buildingMatA },
      { x: 90, z: 30, w: 35, h: 45, d: 40, mat: buildingMatB },

      // Central Plaza Surrounding Structures (Accessible Balconies)
      { x: -35, z: 0, w: 20, h: 14, d: 25, mat: buildingMatA },
      { x: 35, z: 0, w: 20, h: 14, d: 25, mat: buildingMatA }
    ];

    cityBuildings.forEach(b => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);

      // Glowing Neon Accent Lines on Buildings
      const neonBandGeo = new THREE.BoxGeometry(b.w + 0.4, 0.6, b.d + 0.4);
      const neonMatChoice = Math.random() > 0.5 ? neonCyanMat : neonPinkMat;
      const neonBand = new THREE.Mesh(neonBandGeo, neonMatChoice);
      neonBand.position.set(b.x, b.h - 4, b.z);
      this.scene.add(neonBand);
    });

    // --- 4. ELEVATED SKYBRIDGES (Connecting Rooftops & Balconies) ---
    // Skybridge 1 (Central Plaza West to East Platform - Height 14m)
    const bridge1 = new THREE.Mesh(new THREE.BoxGeometry(50, 1, 6), metalMat);
    bridge1.position.set(0, 14, 0);
    bridge1.castShadow = true;
    bridge1.receiveShadow = true;
    this.scene.add(bridge1);
    this.colliders.push(bridge1);

    // Bridge 1 Railings
    const rail1A = new THREE.Mesh(new THREE.BoxGeometry(50, 1.2, 0.2), metalMat);
    rail1A.position.set(0, 15, 3);
    this.scene.add(rail1A);
    this.colliders.push(rail1A);

    const rail1B = new THREE.Mesh(new THREE.BoxGeometry(50, 1.2, 0.2), metalMat);
    rail1B.position.set(0, 15, -3);
    this.scene.add(rail1B);
    this.colliders.push(rail1B);

    // Ramps leading up to Skybridge from Central Plaza
    this.createRamp(-15, 7, 0, 5, 14, 25, 0);
    this.createRamp(15, 7, 0, 5, 14, 25, 0);

    // --- 5. CENTRAL URBAN PLAZA MONUMENT ---
    const monumentBase = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 16), metalMat);
    monumentBase.position.set(0, 1.5, 35);
    monumentBase.castShadow = true;
    monumentBase.receiveShadow = true;
    this.scene.add(monumentBase);
    this.colliders.push(monumentBase);

    // Glowing Neon Hologram Pillar
    const holoPillar = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 12, 16), neonCyanMat);
    holoPillar.position.set(0, 9, 35);
    this.scene.add(holoPillar);

    const holoLight = new THREE.PointLight(0x00f0ff, 3, 30);
    holoLight.position.set(0, 9, 35);
    this.scene.add(holoLight);

    // --- 6. VEHICLES & TACTICAL STREET COVER BLOCKS ---
    const vehicles = [
      { x: -12, z: -30, rot: 0.3 },
      { x: 14, z: -30, rot: -0.2 },
      { x: -20, z: 50, rot: 1.2 },
      { x: 20, z: 50, rot: -0.8 },
      { x: -60, z: 0, rot: 0 },
      { x: 60, z: 0, rot: Math.PI / 2 }
    ];

    vehicles.forEach(v => {
      // Tactical Armored Van Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3, 9), buildingMatB);
      body.position.set(v.x, 1.5, v.z);
      body.rotation.y = v.rot;
      body.castShadow = true;
      body.receiveShadow = true;
      this.scene.add(body);
      this.colliders.push(body);

      // Headlight glow
      const headlight = new THREE.PointLight(0xf59e0b, 1.5, 15);
      headlight.position.set(v.x, 1.8, v.z - 4);
      this.scene.add(headlight);
    });

    // Concrete Jersey Barriers
    const streetBarriers = [
      { x: -5, z: -15, sx: 8, sy: 2.2, sz: 1.2 },
      { x: 5, z: -15, sx: 8, sy: 2.2, sz: 1.2 },
      { x: -25, z: 25, sx: 1.2, sy: 2.2, sz: 8 },
      { x: 25, z: 25, sx: 1.2, sy: 2.2, sz: 8 },
      { x: -40, z: -50, sx: 10, sy: 2.2, sz: 1.2 },
      { x: 40, z: -50, sx: 10, sy: 2.2, sz: 1.2 }
    ];

    streetBarriers.forEach(b => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.sx, b.sy, b.sz), sidewalkMat);
      mesh.position.set(b.x, b.y, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);
    });

    // --- 7. JUMP PADS (Launch to Skybridges & Rooftops) ---
    const padPositions = [
      { x: -35, z: -25 },
      { x: 35, z: -25 },
      { x: -35, z: 25 },
      { x: 35, z: 25 },
      { x: 0, z: -60 },
      { x: 0, z: 60 }
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
