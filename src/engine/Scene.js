import * as THREE from 'three';

export class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.colliders = [];
    this.jumpPads = [];
    this.interactiveObjects = [];

    this.initLightingAndEnvironment();
    this.buildMap();
  }

  initLightingAndEnvironment() {
    // Realistic Atmospheric Sky & Fog
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.7);
    this.scene.add(ambientLight);

    // Directional Sunlight with Shadows
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    sunLight.position.set(50, 80, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 200;
    const d = 70;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);

    // Hemisphere Light for Natural Sky Up/Ground Down bounce
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.5);
    this.scene.add(hemiLight);
  }

  buildMap() {
    // --- MATERIALS ---
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.7,
      metalness: 0.1
    });

    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.3
    });

    const metalFrameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8
    });

    const containerRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.5 });
    const containerBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.5 });
    const containerYellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.5 });
    const containerGreenMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.4, metalness: 0.5 });

    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

    const jumpPadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });

    // --- 1. MAIN GROUND ARENA (150x150) ---
    const groundGeo = new THREE.BoxGeometry(160, 2, 160);
    const ground = new THREE.Mesh(groundGeo, asphaltMat);
    ground.position.set(0, -1, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.colliders.push(ground);

    // Ground Grid Lines & Road Markings
    const grid = new THREE.GridHelper(160, 40, 0x00f0ff, 0x334155);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // --- 2. PERIMETER BOUNDARY WALLS (High concrete barriers) ---
    const wallHeight = 16;
    const arenaSize = 160;
    const wallHorizGeo = new THREE.BoxGeometry(arenaSize, wallHeight, 3);
    const wallVertGeo = new THREE.BoxGeometry(3, wallHeight, arenaSize);

    const wallNorth = new THREE.Mesh(wallHorizGeo, concreteMat);
    wallNorth.position.set(0, wallHeight / 2, -arenaSize / 2);
    wallNorth.castShadow = true;
    wallNorth.receiveShadow = true;
    this.scene.add(wallNorth);
    this.colliders.push(wallNorth);

    const wallSouth = new THREE.Mesh(wallHorizGeo, concreteMat);
    wallSouth.position.set(0, wallHeight / 2, arenaSize / 2);
    wallSouth.castShadow = true;
    wallSouth.receiveShadow = true;
    this.scene.add(wallSouth);
    this.colliders.push(wallSouth);

    const wallEast = new THREE.Mesh(wallVertGeo, concreteMat);
    wallEast.position.set(arenaSize / 2, wallHeight / 2, 0);
    wallEast.castShadow = true;
    wallEast.receiveShadow = true;
    this.scene.add(wallEast);
    this.colliders.push(wallEast);

    const wallWest = new THREE.Mesh(wallVertGeo, concreteMat);
    wallWest.position.set(-arenaSize / 2, wallHeight / 2, 0);
    wallWest.castShadow = true;
    wallWest.receiveShadow = true;
    this.scene.add(wallWest);
    this.colliders.push(wallWest);

    // Neon Boundary Trim Lines
    const trimN = new THREE.Mesh(new THREE.BoxGeometry(arenaSize, 0.4, 0.4), neonCyanMat);
    trimN.position.set(0, wallHeight - 1, -arenaSize / 2 + 1.6);
    this.scene.add(trimN);

    const trimS = new THREE.Mesh(new THREE.BoxGeometry(arenaSize, 0.4, 0.4), neonCyanMat);
    trimS.position.set(0, wallHeight - 1, arenaSize / 2 - 1.6);
    this.scene.add(trimS);

    // --- 3. CENTRAL 2-STORY BUILDING & BALCONY ---
    // Building Main Structure (30x12x20)
    const bldWallMat = buildingMat;

    // Ground Floor Back Wall
    const bldBack = new THREE.Mesh(new THREE.BoxGeometry(32, 10, 1), bldWallMat);
    bldBack.position.set(0, 5, -10);
    bldBack.castShadow = true;
    bldBack.receiveShadow = true;
    this.scene.add(bldBack);
    this.colliders.push(bldBack);

    // Building Left Wall
    const bldLeft = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 20), bldWallMat);
    bldLeft.position.set(-16, 5, 0);
    bldLeft.castShadow = true;
    bldLeft.receiveShadow = true;
    this.scene.add(bldLeft);
    this.colliders.push(bldLeft);

    // Building Right Wall
    const bldRight = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 20), bldWallMat);
    bldRight.position.set(16, 5, 0);
    bldRight.castShadow = true;
    bldRight.receiveShadow = true;
    this.scene.add(bldRight);
    this.colliders.push(bldRight);

    // Second Floor Balcony Floor Platform (Height = 5m)
    const balconyFloor = new THREE.Mesh(new THREE.BoxGeometry(32, 0.8, 12), metalFrameMat);
    balconyFloor.position.set(0, 5, -4);
    balconyFloor.castShadow = true;
    balconyFloor.receiveShadow = true;
    this.scene.add(balconyFloor);
    this.colliders.push(balconyFloor);

    // Balcony Front Railing
    const railingGeo = new THREE.BoxGeometry(32, 1.2, 0.3);
    const railing = new THREE.Mesh(railingGeo, metalFrameMat);
    railing.position.set(0, 6, 2);
    railing.castShadow = true;
    this.scene.add(railing);
    this.colliders.push(railing);

    // Stairs / Ramps up to Balcony (Left & Right)
    this.createRamp(-12, 2.5, 4, 4, 5, 10, 0);
    this.createRamp(12, 2.5, 4, 4, 5, 10, 0);

    // --- 4. TACTICAL SHIPPING CONTAINERS (Red, Blue, Yellow, Green) ---
    const containers = [
      { x: -35, y: 2.5, z: -25, rot: 0, mat: containerRedMat },
      { x: -35, y: 7.5, z: -25, rot: 0.1, mat: containerRedMat }, // Stacked!
      { x: 35, y: 2.5, z: -25, rot: 0.4, mat: containerBlueMat },
      { x: 35, y: 7.5, z: -25, rot: 0.4, mat: containerBlueMat }, // Stacked!
      { x: -45, y: 2.5, z: 20, rot: -0.5, mat: containerYellowMat },
      { x: 45, y: 2.5, z: 20, rot: 0.3, mat: containerGreenMat },
      { x: 0, y: 2.5, z: 40, rot: Math.PI / 2, mat: containerRedMat },
      { x: -20, y: 2.5, z: 35, rot: 0, mat: containerBlueMat },
      { x: 20, y: 2.5, z: 35, rot: -0.2, mat: containerYellowMat }
    ];

    containers.forEach(c => {
      const geo = new THREE.BoxGeometry(6, 5, 14);
      const mesh = new THREE.Mesh(geo, c.mat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.rotation.y = c.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);

      // Neon edge stripes on containers
      const stripeGeo = new THREE.BoxGeometry(6.1, 0.2, 0.2);
      const stripe = new THREE.Mesh(stripeGeo, neonCyanMat);
      stripe.position.set(c.x, c.y + 2.5, c.z);
      stripe.rotation.y = c.rot;
      this.scene.add(stripe);
    });

    // --- 5. HIGH SNIPER LOOKOUT TOWERS (Corners) ---
    const towerPositions = [
      { x: -55, z: -55 },
      { x: 55, z: -55 },
      { x: -55, z: 55 },
      { x: 55, z: 55 }
    ];

    towerPositions.forEach(tp => {
      // Tower Platform (Height = 8m)
      const platGeo = new THREE.BoxGeometry(10, 0.8, 10);
      const plat = new THREE.Mesh(platGeo, concreteMat);
      plat.position.set(tp.x, 8, tp.z);
      plat.castShadow = true;
      plat.receiveShadow = true;
      this.scene.add(plat);
      this.colliders.push(plat);

      // Tower Support Pillars
      const pillarGeo = new THREE.BoxGeometry(1, 8, 1);
      const offsets = [-4, 4];
      offsets.forEach(ox => {
        offsets.forEach(oz => {
          const pillar = new THREE.Mesh(pillarGeo, metalFrameMat);
          pillar.position.set(tp.x + ox, 4, tp.z + oz);
          pillar.castShadow = true;
          this.scene.add(pillar);
          this.colliders.push(pillar);
        });
      });

      // Tower Ramp
      this.createRamp(tp.x, 4, tp.z + (tp.z < 0 ? 9 : -9), 3, 8, 12, tp.z < 0 ? 0 : Math.PI);
    });

    // --- 6. CONCRETE BARRIERS & COVER BLOCKS ---
    const barriers = [
      { x: -10, y: 1.2, z: -25, sx: 6, sy: 2.4, sz: 1 },
      { x: 10, y: 1.2, z: -25, sx: 6, sy: 2.4, sz: 1 },
      { x: -15, y: 1.2, z: -45, sx: 8, sy: 2.4, sz: 1 },
      { x: 15, y: 1.2, z: -45, sx: 8, sy: 2.4, sz: 1 },
      { x: 0, y: 1.2, z: 15, sx: 10, sy: 2.4, sz: 1.5 },
      { x: -25, y: 1.2, z: 0, sx: 1.5, sy: 2.4, sz: 10 },
      { x: 25, y: 1.2, z: 0, sx: 1.5, sy: 2.4, sz: 10 }
    ];

    barriers.forEach(b => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.sx, b.sy, b.sz), concreteMat);
      mesh.position.set(b.x, b.y, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);
    });

    // --- 7. JUMP PADS (Green Energy Boost Pads) ---
    const padPositions = [
      { x: -25, z: -15 },
      { x: 25, z: -15 },
      { x: 0, z: 25 },
      { x: -40, z: 40 },
      { x: 40, z: 40 }
    ];

    padPositions.forEach(p => {
      const padGeo = new THREE.CylinderGeometry(2.2, 2.8, 0.4, 16);
      const padMesh = new THREE.Mesh(padGeo, jumpPadMat);
      padMesh.position.set(p.x, 0.2, p.z);
      this.scene.add(padMesh);
      this.jumpPads.push(padMesh);

      // Light glow above jump pad
      const light = new THREE.PointLight(0x10b981, 1.5, 12);
      light.position.set(p.x, 1.5, p.z);
      this.scene.add(light);
    });
  }

  createRamp(x, y, z, width, height, length, rotationY) {
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.4 });
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
