import * as THREE from 'three';
import { io } from 'socket.io-client';
import { GameScene } from './engine/Scene.js';
import { WeaponManager } from './engine/Weapons.js';
import { PlayerController } from './engine/PlayerController.js';
import { ParticleFX } from './engine/Particles.js';
import { BotManager } from './engine/BotAI.js';
import { soundEngine } from './engine/Audio.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Stats
    this.username = 'Agent_Nova';
    this.selectedWeapon = 'assault';
    this.health = 100;
    this.kills = 0;
    this.deaths = 0;
    this.isPlaying = false;
    this.lastShotTime = 0;

    // Remote Players Map
    this.remotePlayers = new Map();

    this.initThreeJS();
    this.initGameModules();
    this.initSocket();
    this.initUI();
    this.initEvents();

    this.clock = new THREE.Clock();
    this.animate();
  }

  initThreeJS() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
  }

  initGameModules() {
    // Scene setup
    this.gameScene = new GameScene();

    // Weapon Manager attached to camera
    this.gameScene.scene.add(this.camera);
    this.weapons = new WeaponManager(this.camera);

    // Player Physics Controller
    this.player = new PlayerController(
      this.camera,
      this.canvas,
      this.gameScene.colliders,
      this.gameScene.jumpPads
    );

    // Particle FX Engine
    this.particles = new ParticleFX(this.gameScene.scene);

    // Bot AI Manager
    this.bots = new BotManager(this.gameScene.scene, this.gameScene.colliders);

    // Raycaster for shooting
    this.raycaster = new THREE.Raycaster();
  }

  initSocket() {
    // Connect to Socket.io server
    const serverUrl = window.location.origin.includes('5173')
      ? 'http://localhost:3000'
      : window.location.origin;

    this.socket = io(serverUrl, { autoConnect: true });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to server:', this.socket.id);
      document.getElementById('hud-ip-display').textContent = `ONLINE (${window.location.hostname})`;
    });

    this.socket.on('init_state', (data) => {
      this.selfId = data.selfId;
    });

    this.socket.on('player_joined', (playerData) => {
      this.spawnRemotePlayer(playerData);
    });

    this.socket.on('player_moved', (data) => {
      const p = this.remotePlayers.get(data.id);
      if (p) {
        p.targetPos.set(data.x, data.y, data.z);
        p.targetRotY = data.rotY;
      }
    });

    this.socket.on('player_shot', (data) => {
      const origin = new THREE.Vector3().copy(data.origin);
      const dir = new THREE.Vector3().copy(data.direction);
      const endPos = new THREE.Vector3().copy(origin).addScaledVector(dir, 50);

      this.particles.createTracer(origin, endPos);
      soundEngine.playGunshot(data.weapon || 'assault');
    });

    this.socket.on('player_killed', (data) => {
      this.addKillFeed(data.text);
      if (data.killerId === this.selfId) {
        this.kills++;
        document.getElementById('hud-kills').textContent = this.kills;
        soundEngine.playHitmarker(data.isHeadshot, true);
      }
      if (data.victimId === this.selfId) {
        this.deaths++;
        document.getElementById('hud-deaths').textContent = this.deaths;
      }
    });

    this.socket.on('respawn', (data) => {
      this.health = 100;
      this.player.teleport(data.x, data.y, data.z);
      this.updateHealthUI();
    });

    this.socket.on('player_left', (data) => {
      const p = this.remotePlayers.get(data.id);
      if (p) {
        this.gameScene.scene.remove(p.mesh);
        this.remotePlayers.delete(data.id);
      }
    });
  }

  spawnRemotePlayer(data) {
    if (data.id === this.socket.id) return;

    const armorMat = new THREE.MeshStandardMaterial({ color: data.color || 0x00f0ff, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

    const group = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), armorMat);
    torso.position.y = 1.0;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), darkMat);
    head.position.y = 1.7;
    group.add(head);

    group.position.set(data.x, data.y, data.z);
    this.gameScene.scene.add(group);

    this.remotePlayers.set(data.id, {
      id: data.id,
      mesh: group,
      headMesh: head,
      position: group.position,
      targetPos: new THREE.Vector3(data.x, data.y, data.z),
      targetRotY: 0,
      username: data.username
    });
  }

  initUI() {
    // Weapon loadout buttons
    document.querySelectorAll('.loadout-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.loadout-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedWeapon = btn.dataset.weapon;
      });
    });

    // Deploy to Arena button
    document.getElementById('btn-deploy').addEventListener('click', () => {
      const nameInput = document.getElementById('username-input').value.trim();
      if (nameInput) this.username = nameInput;

      document.getElementById('hud-username').textContent = this.username.toUpperCase();
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');

      soundEngine.init();
      this.weapons.equip(this.selectedWeapon);
      this.player.teleport(0, 0, 0);
      this.canvas.requestPointerLock();
      this.isPlaying = true;

      // Notify socket
      this.socket.emit('join_game', {
        username: this.username,
        weapon: this.selectedWeapon
      });

      // Spawn AI opponent bots if playing solo
      if (this.bots.bots.size === 0) {
        this.bots.spawnBot('bot_1', 'CyberBot Alpha', 15, 3, -15, '#ff0055');
        this.bots.spawnBot('bot_2', 'Viper Bot', -15, 3, 20, '#f59e0b');
        this.bots.spawnBot('bot_3', 'Spectre Bot', 25, 3, 25, '#10b981');
        this.bots.spawnBot('bot_4', 'Phantom Bot', -25, 3, -25, '#8b5cf6');
      }
    });
  }

  initEvents() {
    // Resize Listener
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Pointer Lock change
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) {
        if (this.isPlaying) {
          document.getElementById('lobby-screen').classList.remove('hidden');
        }
      }
    });

    // Mouse Controls (Shoot & Scope ADS)
    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || document.pointerLockElement !== this.canvas) return;

      if (e.button === 0) {
        // Left Click: Shoot
        this.shoot();
      } else if (e.button === 2) {
        // Right Click: ADS Scope
        this.weapons.isADS = true;
        if (this.weapons.currentWeaponKey === 'sniper') {
          document.getElementById('scope-overlay').classList.remove('hidden');
          this.camera.fov = 30;
          this.camera.updateProjectionMatrix();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.weapons.isADS = false;
        document.getElementById('scope-overlay').classList.add('hidden');
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.weapons.updateMouseSway(e.movementX, e.movementY);
      }
    });

    // Keyboard Shortcuts (1-3 for weapons, R for reload, Tab for Leaderboard)
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;

      if (e.code === 'Digit1') this.switchWeapon('assault');
      if (e.code === 'Digit2') this.switchWeapon('sniper');
      if (e.code === 'Digit3') this.switchWeapon('pistol');

      if (e.code === 'KeyR') {
        const w = this.weapons.weapons[this.weapons.currentWeaponKey];
        if (w && w.currentAmmo < w.maxAmmo) {
          soundEngine.playReload();
          setTimeout(() => {
            w.currentAmmo = w.maxAmmo;
            this.updateAmmoUI();
          }, w.reloadTime);
        }
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        document.getElementById('leaderboard').classList.remove('hidden');
        this.updateLeaderboard();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        document.getElementById('leaderboard').classList.add('hidden');
      }
    });
  }

  switchWeapon(weaponKey) {
    this.weapons.equip(weaponKey);
    document.querySelectorAll('.w-slot').forEach(s => s.classList.remove('active'));
    const slotIdx = weaponKey === 'assault' ? 1 : weaponKey === 'sniper' ? 2 : 3;
    const slot = document.getElementById(`slot-${slotIdx}`);
    if (slot) slot.classList.add('active');

    const w = this.weapons.weapons[weaponKey];
    document.getElementById('hud-weapon-name').textContent = w.name.toUpperCase();
    this.updateAmmoUI();
  }

  shoot() {
    const now = performance.now();
    const w = this.weapons.weapons[this.weapons.currentWeaponKey];
    if (!w) return;

    // Fire rate check
    if (now - this.lastShotTime < w.fireRate) return;
    if (w.currentAmmo <= 0) {
      soundEngine.playClick(soundEngine.ctx ? soundEngine.ctx.currentTime : 0, 400, 0.05);
      return;
    }

    this.lastShotTime = now;
    w.currentAmmo--;
    this.updateAmmoUI();

    // Sound & Weapon Recoil Kick
    soundEngine.playGunshot(this.weapons.currentWeaponKey);
    this.weapons.triggerRecoil();

    // Raycast shooting calculation
    const rayOrigin = this.camera.position.clone();
    const rayDir = new THREE.Vector3();
    this.camera.getWorldDirection(rayDir);

    // Target meshes list
    const targets = [];
    this.remotePlayers.forEach(p => {
      targets.push(p.mesh);
    });
    this.bots.bots.forEach(b => {
      if (b.health > 0) targets.push(b.mesh);
    });
    this.gameScene.colliders.forEach(c => targets.push(c));

    this.raycaster.set(rayOrigin, rayDir);
    const intersects = this.raycaster.intersectObjects(targets, true);

    let endPos = rayOrigin.clone().addScaledVector(rayDir, 100);

    if (intersects.length > 0) {
      const hit = intersects[0];
      endPos = hit.point.clone();

      // Check hit object
      let targetBot = null;
      let targetRemote = null;

      // Identify bot target
      this.bots.bots.forEach(b => {
        if (b.mesh.getObjectById(hit.object.id) || b.mesh === hit.object) {
          targetBot = b;
        }
      });

      // Identify remote player
      this.remotePlayers.forEach(p => {
        if (p.mesh.getObjectById(hit.object.id) || p.mesh === hit.object) {
          targetRemote = p;
        }
      });

      if (targetBot) {
        const isHeadshot = hit.object === targetBot.headMesh;
        const damage = w.damage * (isHeadshot ? w.headshotMult : 1.0);
        targetBot.health = Math.max(0, targetBot.health - damage);

        this.particles.createImpact(hit.point, hit.face.normal, true);
        this.triggerHitmarker(isHeadshot, targetBot.health <= 0);

        if (targetBot.health <= 0) {
          this.kills++;
          document.getElementById('hud-kills').textContent = this.kills;
          this.addKillFeed(`${this.username} ${isHeadshot ? '🎯 HEADSHOT' : 'eliminated'} ${targetBot.username}`);

          // Respawn Bot after 3s
          setTimeout(() => {
            targetBot.health = 100;
            targetBot.position.set((Math.random() - 0.5) * 60, 3, (Math.random() - 0.5) * 60);
          }, 3000);
        }
      } else if (targetRemote) {
        const isHeadshot = hit.object === targetRemote.headMesh;
        const damage = w.damage * (isHeadshot ? w.headshotMult : 1.0);

        this.particles.createImpact(hit.point, hit.face.normal, true);
        this.triggerHitmarker(isHeadshot);

        this.socket.emit('deal_damage', {
          targetId: targetRemote.id,
          damage,
          isHeadshot,
          isBot: false
        });
      } else {
        // Wall spark impact
        this.particles.createImpact(hit.point, hit.face.normal, false);
      }
    }

    // Tracer effect
    this.particles.createTracer(
      new THREE.Vector3().copy(rayOrigin).add(new THREE.Vector3(0.2, -0.2, -0.5).applyQuaternion(this.camera.quaternion)),
      endPos
    );

    // Socket shoot emit
    this.socket.emit('shoot', {
      origin: rayOrigin,
      direction: rayDir,
      weapon: this.weapons.currentWeaponKey
    });
  }

  triggerHitmarker(isHeadshot = false, isKill = false) {
    soundEngine.playHitmarker(isHeadshot, isKill);
    const hm = document.getElementById('hitmarker');
    hm.classList.add('active');
    setTimeout(() => hm.classList.remove('active'), 120);
  }

  updateHealthUI() {
    const fill = document.getElementById('health-bar-fill');
    const val = document.getElementById('health-value');
    fill.style.width = `${this.health}%`;
    val.textContent = Math.round(this.health);

    if (this.health > 50) {
      fill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    } else if (this.health > 25) {
      fill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
    }
  }

  updateAmmoUI() {
    const w = this.weapons.weapons[this.weapons.currentWeaponKey];
    if (w) {
      document.getElementById('hud-ammo-current').textContent = w.currentAmmo;
      document.getElementById('hud-ammo-max').textContent = w.maxAmmo;
    }
  }

  addKillFeed(text) {
    const feed = document.getElementById('killfeed');
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.textContent = text;
    feed.appendChild(entry);

    setTimeout(() => {
      entry.remove();
    }, 4500);
  }

  updateRadar() {
    this.radarCtx.clearRect(0, 0, 130, 130);
    const center = 65;
    const scale = 1.2;

    // Draw radar background grid
    this.radarCtx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    this.radarCtx.beginPath();
    this.radarCtx.arc(center, center, 60, 0, Math.PI * 2);
    this.radarCtx.stroke();

    // Draw player dot (Center Green)
    this.radarCtx.fillStyle = '#10b981';
    this.radarCtx.beginPath();
    this.radarCtx.arc(center, center, 4, 0, Math.PI * 2);
    this.radarCtx.fill();

    // Draw Bots on Radar (Red dots)
    this.bots.bots.forEach(b => {
      if (b.health <= 0) return;
      const dx = (b.position.x - this.player.position.x) * scale;
      const dz = (b.position.z - this.player.position.z) * scale;

      const rx = center + dx;
      const ry = center + dz;

      if (Math.hypot(dx, dz) < 58) {
        this.radarCtx.fillStyle = '#ef4444';
        this.radarCtx.beginPath();
        this.radarCtx.arc(rx, ry, 3.5, 0, Math.PI * 2);
        this.radarCtx.fill();
      }
    });
  }

  updateLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    const list = [
      { name: this.username, kills: this.kills, deaths: this.deaths, hp: Math.round(this.health) }
    ];

    this.bots.bots.forEach(b => {
      list.push({ name: b.username, kills: Math.floor(Math.random() * 5), deaths: 2, hp: Math.round(b.health) });
    });

    list.sort((a, b) => b.kills - a.kills);

    list.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.kills}</td>
        <td>${item.deaths}</td>
        <td>${item.hp}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.isPlaying) {
      // Update Physics & Weapon positioning
      this.player.update(delta);
      this.weapons.update(delta);
      this.particles.update(delta);

      // Update AI Opponent Bots & Bot Shooting at Player
      this.bots.update(delta, this.player.position, (bot, origin, dir) => {
        // Bot shoot callback
        const endPos = new THREE.Vector3().copy(origin).addScaledVector(dir, 40);
        this.particles.createTracer(origin, endPos);
        soundEngine.playGunshot('assault');

        // Check if bot shot hits player
        const dist = origin.distanceTo(this.player.position);
        if (dist < 30) {
          this.health = Math.max(0, this.health - 12);
          this.updateHealthUI();
          soundEngine.playClick(soundEngine.ctx ? soundEngine.ctx.currentTime : 0, 100, 0.1);

          if (this.health <= 0) {
            this.deaths++;
            document.getElementById('hud-deaths').textContent = this.deaths;
            this.addKillFeed(`${bot.username} eliminated ${this.username}`);

            // Respawn player after 3s
            setTimeout(() => {
              this.health = 100;
              this.player.teleport(0, 0, 0);
              this.updateHealthUI();
            }, 3000);
          }
        }
      });

      // Socket Position Broadcast (10 Hz throttling)
      if (this.socket && this.socket.connected) {
        this.socket.emit('player_update', {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          rotX: this.player.rotation.pitch,
          rotY: this.player.rotation.yaw,
          crouch: this.player.isCrouching
        });
      }

      // Smooth interpolation for remote players
      this.remotePlayers.forEach(p => {
        p.position.lerp(p.targetPos, delta * 12);
        p.mesh.rotation.y = THREE.MathUtils.lerp(p.mesh.rotation.y, p.targetRotY, delta * 12);
      });

      // Draw Mini-map Radar
      this.updateRadar();
    }

    this.renderer.render(this.gameScene.scene, this.camera);
  }
}

// Instantiate App on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
