import * as THREE from 'three';

export class WeaponManager {
  constructor(camera) {
    this.camera = camera;
    this.weaponGroup = new THREE.Group();
    this.camera.add(this.weaponGroup);

    // Current equipped weapon
    this.currentWeaponKey = 'assault';
    this.weapons = {};

    // Animation & State variables
    this.recoil = { x: 0, y: 0, z: 0 };
    this.targetRecoil = { x: 0, y: 0, z: 0 };
    this.sway = { x: 0, y: 0 };
    this.targetSway = { x: 0, y: 0 };
    this.isADS = false;

    // Muzzle Flash Light
    this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 10);
    this.weaponGroup.add(this.muzzleLight);

    this.initWeapons();
    this.equip('assault');
  }

  initWeapons() {
    // 1. ASSAULT RIFLE
    const assaultGroup = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.3, metalness: 0.8 });
    const metallicMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.2, metalness: 0.9 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Body receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.6), darkMat);
    body.position.set(0, 0, 0);
    assaultGroup.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 12), metallicMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.45);
    assaultGroup.add(barrel);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.12), darkMat);
    mag.rotation.x = -0.2;
    mag.position.set(0, -0.15, -0.05);
    assaultGroup.add(mag);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.35), darkMat);
    stock.position.set(0, -0.02, 0.4);
    assaultGroup.add(stock);

    // Neon Trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.02, 0.4), neonMat);
    trim.position.set(0, 0.07, -0.05);
    assaultGroup.add(trim);

    this.weapons.assault = {
      name: 'Assault Rifle',
      mesh: assaultGroup,
      hipPos: new THREE.Vector3(0.22, -0.22, -0.45),
      adsPos: new THREE.Vector3(0, -0.13, -0.32),
      damage: 28,
      headshotMult: 2.0,
      fireRate: 110, // ms between shots
      maxAmmo: 30,
      currentAmmo: 30,
      reloadTime: 1800,
      recoilKick: { x: 0.04, y: 0.02, z: 0.06 }
    };

    // 2. SNIPER RIFLE
    const sniperGroup = new THREE.Group();
    const sniperBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.8), darkMat);
    sniperGroup.add(sniperBody);

    const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 12), metallicMat);
    longBarrel.rotation.x = Math.PI / 2;
    longBarrel.position.set(0, 0.03, -0.7);
    sniperGroup.add(longBarrel);

    // Scope Cylinder
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 16), scopeMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.12, -0.1);
    sniperGroup.add(scope);

    this.weapons.sniper = {
      name: 'Heavy Sniper',
      mesh: sniperGroup,
      hipPos: new THREE.Vector3(0.24, -0.24, -0.5),
      adsPos: new THREE.Vector3(0, -0.12, -0.25),
      damage: 85,
      headshotMult: 2.5,
      fireRate: 850,
      maxAmmo: 5,
      currentAmmo: 5,
      reloadTime: 2500,
      recoilKick: { x: 0.12, y: 0.05, z: 0.15 }
    };

    // 3. PISTOL
    const pistolGroup = new THREE.Group();
    const pistolBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), darkMat);
    pistolGroup.add(pistolBody);

    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), darkMat);
    pistolGrip.rotation.x = 0.2;
    pistolGrip.position.set(0, -0.12, 0.08);
    pistolGroup.add(pistolGrip);

    this.weapons.pistol = {
      name: 'Tactical Pistol',
      mesh: pistolGroup,
      hipPos: new THREE.Vector3(0.2, -0.2, -0.35),
      adsPos: new THREE.Vector3(0, -0.12, -0.28),
      damage: 35,
      headshotMult: 1.8,
      fireRate: 220,
      maxAmmo: 12,
      currentAmmo: 12,
      reloadTime: 1200,
      recoilKick: { x: 0.05, y: 0.02, z: 0.08 }
    };

    // Add all weapon meshes hidden
    Object.values(this.weapons).forEach(w => {
      this.weaponGroup.add(w.mesh);
      w.mesh.visible = false;
    });
  }

  equip(key) {
    if (!this.weapons[key]) return;
    if (this.weapons[this.currentWeaponKey]) {
      this.weapons[this.currentWeaponKey].mesh.visible = false;
    }

    this.currentWeaponKey = key;
    const w = this.weapons[key];
    w.mesh.visible = true;
    w.mesh.position.copy(w.hipPos);
    this.isADS = false;
  }

  triggerRecoil() {
    const w = this.weapons[this.currentWeaponKey];
    if (!w) return;

    this.targetRecoil.x += (Math.random() - 0.5) * w.recoilKick.x;
    this.targetRecoil.y += w.recoilKick.y;
    this.targetRecoil.z += w.recoilKick.z;

    // Flash light
    this.muzzleLight.intensity = 4;
    this.muzzleLight.position.set(0, 0, -0.8);
    setTimeout(() => {
      this.muzzleLight.intensity = 0;
    }, 40);
  }

  updateMouseSway(deltaX, deltaY) {
    this.targetSway.x -= deltaX * 0.0003;
    this.targetSway.y -= deltaY * 0.0003;
    this.targetSway.x = THREE.MathUtils.clamp(this.targetSway.x, -0.05, 0.05);
    this.targetSway.y = THREE.MathUtils.clamp(this.targetSway.y, -0.05, 0.05);
  }

  update(delta) {
    const w = this.weapons[this.currentWeaponKey];
    if (!w) return;

    // Smooth Recoil Recovery
    this.recoil.x = THREE.MathUtils.lerp(this.recoil.x, this.targetRecoil.x, delta * 15);
    this.recoil.y = THREE.MathUtils.lerp(this.recoil.y, this.targetRecoil.y, delta * 15);
    this.recoil.z = THREE.MathUtils.lerp(this.recoil.z, this.targetRecoil.z, delta * 15);

    this.targetRecoil.x = THREE.MathUtils.lerp(this.targetRecoil.x, 0, delta * 10);
    this.targetRecoil.y = THREE.MathUtils.lerp(this.targetRecoil.y, 0, delta * 10);
    this.targetRecoil.z = THREE.MathUtils.lerp(this.targetRecoil.z, 0, delta * 10);

    // Smooth Sway Recovery
    this.sway.x = THREE.MathUtils.lerp(this.sway.x, this.targetSway.x, delta * 8);
    this.sway.y = THREE.MathUtils.lerp(this.sway.y, this.targetSway.y, delta * 8);
    this.targetSway.x = THREE.MathUtils.lerp(this.targetSway.x, 0, delta * 5);
    this.targetSway.y = THREE.MathUtils.lerp(this.targetSway.y, 0, delta * 5);

    // Target position (ADS vs Hipfire)
    const targetPos = this.isADS ? w.adsPos : w.hipPos;

    // Apply combined position & rotation transform
    w.mesh.position.x = THREE.MathUtils.lerp(w.mesh.position.x, targetPos.x + this.sway.x, delta * 12);
    w.mesh.position.y = THREE.MathUtils.lerp(w.mesh.position.y, targetPos.y + this.sway.y + this.recoil.y, delta * 12);
    w.mesh.position.z = THREE.MathUtils.lerp(w.mesh.position.z, targetPos.z + this.recoil.z, delta * 12);

    w.mesh.rotation.x = this.recoil.y * 1.5;
    w.mesh.rotation.y = this.recoil.x * 1.5;
    w.mesh.rotation.z = this.sway.x * 2;
  }
}
