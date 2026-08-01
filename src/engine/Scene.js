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
    // Sky & Atmosphere Fog
    this.scene.background = new THREE.Color(0x0a0c16);
    this.scene.fog = new THREE.FogExp2(0x0a0c16, 0.015);

    // Ambient Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    this.scene.add(hemiLight);

    // Sun / Directional Light with Shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Accent Cyber Neon Point Lights
    const cyanLight = new THREE.PointLight(0x00f0ff, 2, 25);
    cyanLight.position.set(0, 10, 0);
    this.scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff007f, 2, 25);
    magentaLight.position.set(0, 8, 20);
    this.scene.add(magentaLight);
  }

  buildMap() {
    // Materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.6
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.3
    });

    const obstacleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.7
    });

    const neonCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    const neonPinkMat = new THREE.MeshBasicMaterial({
      color: 0xff007f
    });

    const jumpPadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });

    // Main Ground (100x100)
    const groundGeo = new THREE.BoxGeometry(120, 2, 120);
    const ground = new THREE.Mesh(groundGeo, floorMat);
    ground.position.set(0, -1, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.colliders.push(ground);

    // Floor Grid Overlay Lines
    const grid = new THREE.GridHelper(120, 40, 0x00f0ff, 0x1e293b);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Outer Arena Boundary Walls
    const wallHeight = 15;
    const arenaSize = 120;
    const wallGeoHoriz = new THREE.BoxGeometry(arenaSize, wallHeight, 2);
    const wallGeoVert = new THREE.BoxGeometry(2, wallHeight, arenaSize);

    const wallNorth = new THREE.Mesh(wallGeoHoriz, wallMat);
    wallNorth.position.set(0, wallHeight / 2, -arenaSize / 2);
    wallNorth.castShadow = true;
    wallNorth.receiveShadow = true;
    this.scene.add(wallNorth);
    this.colliders.push(wallNorth);

    const wallSouth = new THREE.Mesh(wallGeoHoriz, wallMat);
    wallSouth.position.set(0, wallHeight / 2, arenaSize / 2);
    wallSouth.castShadow = true;
    wallSouth.receiveShadow = true;
    this.scene.add(wallSouth);
    this.colliders.push(wallSouth);

    const wallEast = new THREE.Mesh(wallGeoVert, wallMat);
    wallEast.position.set(arenaSize / 2, wallHeight / 2, 0);
    wallEast.castShadow = true;
    wallEast.receiveShadow = true;
    this.scene.add(wallEast);
    this.colliders.push(wallEast);

    const wallWest = new THREE.Mesh(wallGeoVert, wallMat);
    wallWest.position.set(-arenaSize / 2, wallHeight / 2, 0);
    wallWest.castShadow = true;
    wallWest.receiveShadow = true;
    this.scene.add(wallWest);
    this.colliders.push(wallWest);

    // Neon Wall Trims
    const trimGeoNorth = new THREE.BoxGeometry(arenaSize, 0.4, 0.4);
    const trimNorth = new THREE.Mesh(trimGeoNorth, neonCyanMat);
    trimNorth.position.set(0, wallHeight - 1, -arenaSize / 2 + 1);
    this.scene.add(trimNorth);

    const trimSouth = new THREE.Mesh(trimGeoNorth, neonCyanMat);
    trimSouth.position.set(0, wallHeight - 1, arenaSize / 2 - 1);
    this.scene.add(trimSouth);

    // Central Platform Complex
    const centerPlatformGeo = new THREE.BoxGeometry(24, 4, 24);
    const centerPlatform = new THREE.Mesh(centerPlatformGeo, obstacleMat);
    centerPlatform.position.set(0, 2, 0);
    centerPlatform.castShadow = true;
    centerPlatform.receiveShadow = true;
    this.scene.add(centerPlatform);
    this.colliders.push(centerPlatform);

    // Central Elevated Tower
    const towerGeo = new THREE.BoxGeometry(10, 8, 10);
    const tower = new THREE.Mesh(towerGeo, obstacleMat);
    tower.position.set(0, 8, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    this.colliders.push(tower);

    // Tower Neon Strip
    const towerTrimGeo = new THREE.BoxGeometry(10.2, 0.3, 10.2);
    const towerTrim = new THREE.Mesh(towerTrimGeo, neonPinkMat);
    towerTrim.position.set(0, 11.5, 0);
    this.scene.add(towerTrim);

    // Ramps leading up to central platform
    this.createRamp(0, 2, -18, 8, 4, 12, 0);
    this.createRamp(0, 2, 18, 8, 4, 12, Math.PI);

    // Cover Crates & Barrier Blocks
    const cratePositions = [
      { x: -18, y: 1.5, z: -15, sx: 4, sy: 3, sz: 4 },
      { x: 18, y: 1.5, z: -15, sx: 4, sy: 3, sz: 4 },
      { x: -18, y: 1.5, z: 15, sx: 4, sy: 3, sz: 4 },
      { x: 18, y: 1.5, z: 15, sx: 4, sy: 3, sz: 4 },
      { x: -35, y: 2, z: 0, sx: 6, sy: 4, sz: 12 },
      { x: 35, y: 2, z: 0, sx: 6, sy: 4, sz: 12 },
      { x: 0, y: 2, z: -35, sx: 12, sy: 4, sz: 6 },
      { x: 0, y: 2, z: 35, sx: 12, sy: 4, sz: 6 },
      { x: -25, y: 3, z: -30, sx: 8, sy: 6, sz: 8 },
      { x: 25, y: 3, z: 30, sx: 8, sy: 6, sz: 8 }
    ];

    cratePositions.forEach(pos => {
      const geo = new THREE.BoxGeometry(pos.sx, pos.sy, pos.sz);
      const mesh = new THREE.Mesh(geo, obstacleMat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(mesh);
    });

    // Jump Pads (Launch player high into the air)
    const padPositions = [
      { x: -22, z: 0 },
      { x: 22, z: 0 },
      { x: 0, z: -25 },
      { x: 0, z: 25 }
    ];

    padPositions.forEach(p => {
      const padGeo = new THREE.CylinderGeometry(2, 2.5, 0.4, 16);
      const padMesh = new THREE.Mesh(padGeo, jumpPadMat);
      padMesh.position.set(p.x, 0.2, p.z);
      this.scene.add(padMesh);
      this.jumpPads.push(padMesh);
    });
  }

  createRamp(x, y, z, width, height, length, rotationY) {
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
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
