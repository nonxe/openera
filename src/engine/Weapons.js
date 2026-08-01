import * as THREE from 'three';
import { TextureGen } from './TextureGen.js';

export class WeaponManager {
  constructor(camera) {
    this.camera = camera;
    this.weaponGroup = new THREE.Group();
    this.camera.add(this.weaponGroup);

    this.currentWeaponKey = 'assault';
    this.weapons = {};

    this.recoil = { x: 0, y: 0, z: 0 };
    this.targetRecoil = { x: 0, y: 0, z: 0 };
    this.sway = { x: 0, y: 0 };
    this.targetSway = { x: 0, y: 0 };
    this.isADS = false;

    // Muzzle Flash Point Light
    this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 15);
    this.weaponGroup.add(this.muzzleLight);

    this.initTextures();
    this.initWeapons();
    this.equip('assault');
  }

  initTextures() {
    this.gunMetalTex = TextureGen.createGunMetalTexture();
    this.woodTex = TextureGen.createWoodTexture();
  }

  initWeapons() {
    const gunMetalMat = new THREE.MeshStandardMaterial({
      map: this.gunMetalTex,
      roughness: 0.3,
      metalness: 0.85
    });

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.woodTex,
      roughness: 0.5,
      metalness: 0.1
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.1,
      metalness: 0.95
    });

    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.9 });

    // --- 1. HIGH DETAIL AK-47 ASSAULT RIFLE ---
    const assaultGroup = new THREE.Group();

    // Main Receiver Body
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), gunMetalMat);
    receiver.position.set(0, 0, 0);
    assaultGroup.add(receiver);

    // Dust Cover Top Plate
    const topCover = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.48, 12, 1, false, 0, Math.PI), gunMetalMat);
    topCover.rotation.z = Math.PI / 2;
    topCover.rotation.y = Math.PI / 2;
    topCover.position.set(0, 0.08, 0.01);
    assaultGroup.add(topCover);

    // Wooden Handguard (Front Barrel Grip)
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.35), woodMat);
    handguard.position.set(0, 0.01, -0.38);
    assaultGroup.add(handguard);

    // Steel Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 16), chromeMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.55);
    assaultGroup.add(barrel);

    // Flash Hider Muzzle Tip
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.1, 12), darkSteelMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.04, -0.87);
    assaultGroup.add(muzzle);

    // Curved Banana Magazine
    const magGroup = new THREE.Group();
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.14), darkSteelMat);
    mag.rotation.x = -0.3;
    mag.position.set(0, -0.16, -0.06);
    magGroup.add(mag);
    assaultGroup.add(magGroup);

    // Wooden Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), woodMat);
    grip.rotation.x = 0.3;
    grip.position.set(0, -0.16, 0.15);
    assaultGroup.add(grip);

    // Wooden Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.4), woodMat);
    stock.position.set(0, -0.02, 0.42);
    assaultGroup.add(stock);

    // Front Iron Sight Post
    const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.03), darkSteelMat);
    sightFront.position.set(0, 0.1, -0.78);
    assaultGroup.add(sightFront);

    // Neon Accent Strip
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.015, 0.45), neonCyanMat);
    trim.position.set(0, 0.085, 0);
    assaultGroup.add(trim);

    this.weapons.assault = {
      name: 'AK-47 Assault',
      mesh: assaultGroup,
      hipPos: new THREE.Vector3(0.24, -0.22, -0.45),
      adsPos: new THREE.Vector3(0, -0.122, -0.32),
      damage: 32,
      headshotMult: 2.0,
      fireRate: 110,
      maxAmmo: 30,
      currentAmmo: 30,
      reloadTime: 1800,
      recoilKick: { x: 0.04, y: 0.02, z: 0.06 }
    };

    // --- 2. HEAVY SNIPER RIFLE ---
    const sniperGroup = new THREE.Group();

    // Heavy Receiver
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.85), darkSteelMat);
    sniperGroup.add(sBody);

    // Long Heavy Barrel
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 16), chromeMat);
    sBarrel.rotation.x = Math.PI / 2;
    sBarrel.position.set(0, 0.04, -0.85);
    sniperGroup.add(sBarrel);

    // Large Muzzle Brake
    const sMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.15), darkSteelMat);
    sMuzzle.position.set(0, 0.04, -1.35);
    sniperGroup.add(sMuzzle);

    // Scope Cylinder & Lenses
    const sScopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 24), darkSteelMat);
    sScopeBody.rotation.x = Math.PI / 2;
    sScopeBody.position.set(0, 0.15, -0.1);
    sniperGroup.add(sScopeBody);

    // Scope Glass Lens Glow
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const lensFront = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16), lensMat);
    lensFront.position.set(0, 0.15, -0.301);
    sniperGroup.add(lensFront);

    // Scope Mounting Rings
    const ring1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), chromeMat);
    ring1.position.set(0, 0.1, 0.02);
    sniperGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), chromeMat);
    ring2.position.set(0, 0.1, -0.22);
    sniperGroup.add(ring2);

    this.weapons.sniper = {
      name: 'Heavy Sniper',
      mesh: sniperGroup,
      hipPos: new THREE.Vector3(0.26, -0.24, -0.5),
      adsPos: new THREE.Vector3(0, -0.15, -0.25),
      damage: 85,
      headshotMult: 2.5,
      fireRate: 850,
      maxAmmo: 5,
      currentAmmo: 5,
      reloadTime: 2500,
      recoilKick: { x: 0.12, y: 0.05, z: 0.15 }
    };

    // --- 3. TACTICAL PISTOL ---
    const pistolGroup = new THREE.Group();

    // Slide Body
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.32), chromeMat);
    pistolGroup.add(pSlide);

    // Polymer Frame & Grip
    const pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.12), darkSteelMat);
    pFrame.rotation.x = 0.25;
    pFrame.position.set(0, -0.12, 0.08);
    pistolGroup.add(pFrame);

    // Pistol Barrel Tip
    const pBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12), darkSteelMat);
    pBarrel.rotation.x = Math.PI / 2;
    pBarrel.position.set(0, 0.02, -0.2);
    pistolGroup.add(pBarrel);

    this.weapons.pistol = {
      name: 'Tactical Pistol',
      mesh: pistolGroup,
      hipPos: new THREE.Vector3(0.2, -0.2, -0.35),
      adsPos: new THREE.Vector3(0, -0.05, -0.28),
      damage: 35,
      headshotMult: 1.8,
      fireRate: 200,
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

    this.muzzleLight.intensity = 5;
    this.muzzleLight.position.set(0, 0, -0.9);
    setTimeout(() => {
      this.muzzleLight.intensity = 0;
    }, 45);
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

    // Sway Recovery
    this.sway.x = THREE.MathUtils.lerp(this.sway.x, this.targetSway.x, delta * 8);
    this.sway.y = THREE.MathUtils.lerp(this.sway.y, this.targetSway.y, delta * 8);
    this.targetSway.x = THREE.MathUtils.lerp(this.targetSway.x, 0, delta * 5);
    this.targetSway.y = THREE.MathUtils.lerp(this.targetSway.y, 0, delta * 5);

    const targetPos = this.isADS ? w.adsPos : w.hipPos;

    w.mesh.position.x = THREE.MathUtils.lerp(w.mesh.position.x, targetPos.x + this.sway.x, delta * 14);
    w.mesh.position.y = THREE.MathUtils.lerp(w.mesh.position.y, targetPos.y + this.sway.y + this.recoil.y, delta * 14);
    w.mesh.position.z = THREE.MathUtils.lerp(w.mesh.position.z, targetPos.z + this.recoil.z, delta * 14);

    w.mesh.rotation.x = this.recoil.y * 1.5;
    w.mesh.rotation.y = this.recoil.x * 1.5;
    w.mesh.rotation.z = this.sway.x * 2;
  }
}
