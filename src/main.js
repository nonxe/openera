import * as THREE from 'three';
import { io } from 'socket.io-client';
import { GameScene } from './engine/Scene.js';
import { WeaponManager } from './engine/Weapons.js';
import { PlayerController } from './engine/PlayerController.js';
import { ParticleFX } from './engine/Particles.js';
import { soundEngine } from './engine/Audio.js';
import { RacingMode } from './engine/RacingMode.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Player Stats & State
    this.username = 'Viper_X';
    this.selectedWeapon = 'assault';
    this.selectedCarColor = '#00f0ff';
    this.gameMode = 'FFA'; // 'FFA', 'TDM', or 'RACE'
    this.team = 'none';
    this.health = 100;
    this.kills = 0;
    this.deaths = 0;
    this.isPlaying = false;
    this.isRacing = false;
    this.lastShotTime = 0;
    this.isShopOpen = false;
    this.racingMode = null;
    this.raceKeys = {
      forward: false, backward: false, left: false, right: false,
      drift: false, nitro: false
    };

    // Remote Players Map (Pure Online Humans)
    this.remotePlayers = new Map();

    this.initThreeJS();
    this.initGameModules();
    this.initSocket();
    this.initUI();
    this.initEvents();
    this.initRaceSocketEvents();

    this.clock = new THREE.Clock();
    this.animate();
  }

  initThreeJS() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  }

  initGameModules() {
    this.gameScene = new GameScene();
    this.gameScene.scene.add(this.camera);

    this.weapons = new WeaponManager(this.camera);

    this.player = new PlayerController(
      this.camera,
      this.canvas,
      this.gameScene.colliders,
      this.gameScene.jumpPads
    );

    this.particles = new ParticleFX(this.gameScene.scene);
    this.raycaster = new THREE.Raycaster();
  }

  initSocket() {
    const serverUrl = window.location.origin.includes('5173')
      ? 'http://localhost:3000'
      : window.location.origin;

    this.socket = io(serverUrl, { autoConnect: true });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected as real player:', this.socket.id);
      document.getElementById('hud-ip-display').textContent = `ONLINE REAL PLAYERS (${window.location.hostname})`;
    });

    this.socket.on('init_state', (data) => {
      this.selfId = data.selfId;
      this.gameMode = data.mode;
      
      if (this.gameMode === 'TDM') {
        document.getElementById('tdm-score-box').classList.remove('hidden');
        this.updateTDMScore(data.teamScores);
      }

      data.players.forEach(p => {
        if (p.id !== this.selfId) {
          this.spawnRemotePlayer(p);
        } else {
          this.team = p.team;
        }
      });
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
      const endPos = new THREE.Vector3().copy(origin).addScaledVector(dir, 80);

      this.particles.createTracer(origin, endPos);
      soundEngine.playGunshot(data.weapon || 'assault');
    });

    this.socket.on('damaged', (data) => {
      this.health = data.health;
      this.updateHealthUI();
      soundEngine.playClick(soundEngine.ctx ? soundEngine.ctx.currentTime : 0, 120, 0.1);
    });

    this.socket.on('player_killed', (data) => {
      this.addKillFeed(data.text);
      if (data.teamScores && this.gameMode === 'TDM') {
        this.updateTDMScore(data.teamScores);
      }

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

    const teamColor = data.team === 'alpha' ? 0x00f0ff : data.team === 'bravo' ? 0xff007f : 0x10b981;
    const armorMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.3, metalness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const group = new THREE.Group();

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), armorMat);
    torso.position.y = 1.0;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), darkMat);
    head.position.y = 1.7;
    group.add(head);

    // Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.1), visorMat);
    visor.position.set(0, 1.72, -0.2);
    group.add(visor);

    group.position.set(data.x, data.y, data.z);
    this.gameScene.scene.add(group);

    this.remotePlayers.set(data.id, {
      id: data.id,
      mesh: group,
      headMesh: head,
      position: group.position,
      targetPos: new THREE.Vector3(data.x, data.y, data.z),
      targetRotY: 0,
      username: data.username,
      team: data.team,
      color: data.color
    });
  }

  initUI() {
    // Mode selector
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gameMode = btn.dataset.mode;
        // Toggle weapon/car selection visibility
        const weaponGroup = document.getElementById('weapon-selector-group');
        const carGroup = document.getElementById('car-color-group');
        if (this.gameMode === 'RACE') {
          weaponGroup.classList.add('hidden');
          carGroup.classList.remove('hidden');
        } else {
          weaponGroup.classList.remove('hidden');
          carGroup.classList.add('hidden');
        }
      });
    });

    // Car color selector
    document.querySelectorAll('.car-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.car-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCarColor = btn.dataset.color;
      });
    });

    // Weapon selector in lobby
    document.querySelectorAll('.loadout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loadout-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedWeapon = btn.dataset.weapon;
      });
    });

    // Mid-match Weapon Shop Modal items
    document.querySelectorAll('.shop-item').forEach(item => {
      item.addEventListener('click', () => {
        const weaponKey = item.dataset.weapon;
        this.switchWeapon(weaponKey);
        this.socket.emit('change_weapon', { weapon: weaponKey });
        this.toggleWeaponShop(false);
      });
    });

    document.getElementById('btn-open-shop').addEventListener('click', () => {
      this.toggleWeaponShop(true);
    });

    // Deploy to match
    document.getElementById('btn-deploy').addEventListener('click', () => {
      const nameInput = document.getElementById('username-input').value.trim();
      if (nameInput) this.username = nameInput;

      document.getElementById('hud-username').textContent = this.username.toUpperCase();
      document.getElementById('lobby-screen').classList.add('hidden');

      soundEngine.init();

      if (this.gameMode === 'RACE') {
        // --- RACING MODE ---
        this.isRacing = true;
        this.isPlaying = true;
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('race-hud').classList.remove('hidden');

        this.racingMode = new RacingMode(this.gameScene.scene, this.camera, this.socket);
        this.racingMode.startRace();

        // Hide FPS weapon
        this.weapons.weaponGroup.visible = false;

        this.socket.emit('join_race', {
          username: this.username,
          color: this.selectedCarColor
        });

        // Init racing key listeners
        this.initRaceKeyListeners();
      } else {
        // --- FPS MODE ---
        this.isRacing = false;
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('race-hud').classList.add('hidden');

        this.weapons.weaponGroup.visible = true;
        this.weapons.equip(this.selectedWeapon);
        this.player.teleport(0, 0, 0);
        this.canvas.requestPointerLock();
        this.isPlaying = true;

        this.socket.emit('join_game', {
          username: this.username,
          weapon: this.selectedWeapon,
          mode: this.gameMode
        });
      }
    });

    // Race back to lobby button
    const raceBackBtn = document.getElementById('btn-race-back');
    if (raceBackBtn) {
      raceBackBtn.addEventListener('click', () => {
        document.getElementById('race-finish-screen').classList.add('hidden');
        document.getElementById('race-hud').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        if (this.racingMode) {
          this.racingMode.dispose();
          this.racingMode = null;
        }
        this.isRacing = false;
        this.isPlaying = false;
      });
    }
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && !this.isShopOpen) {
        if (this.isPlaying) {
          document.getElementById('lobby-screen').classList.remove('hidden');
        }
      }
    });

    // Mouse Shoot & Scope
    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || document.pointerLockElement !== this.canvas || this.isShopOpen) return;

      if (e.button === 0) {
        this.shoot();
      } else if (e.button === 2) {
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
      if (document.pointerLockElement === this.canvas && !this.isShopOpen) {
        this.weapons.updateMouseSway(e.movementX, e.movementY);
      }
    });

    // Keyboard Shortcuts (B for Weapon Shop, 1-3, R, Tab)
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;

      if (e.code === 'KeyB') {
        this.toggleWeaponShop(!this.isShopOpen);
      }

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

  toggleWeaponShop(open) {
    this.isShopOpen = open;
    const modal = document.getElementById('weapon-shop-modal');
    if (open) {
      modal.classList.remove('hidden');
      document.exitPointerLock();
    } else {
      modal.classList.add('hidden');
      if (this.isPlaying) this.canvas.requestPointerLock();
    }
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

    if (now - this.lastShotTime < w.fireRate) return;
    if (w.currentAmmo <= 0) {
      soundEngine.playClick(soundEngine.ctx ? soundEngine.ctx.currentTime : 0, 400, 0.05);
      return;
    }

    this.lastShotTime = now;
    w.currentAmmo--;
    this.updateAmmoUI();

    soundEngine.playGunshot(this.weapons.currentWeaponKey);
    this.weapons.triggerRecoil();

    const rayOrigin = this.camera.position.clone();
    const rayDir = new THREE.Vector3();
    this.camera.getWorldDirection(rayDir);

    const targets = [];
    this.remotePlayers.forEach(p => targets.push(p.mesh));
    this.gameScene.colliders.forEach(c => targets.push(c));

    this.raycaster.set(rayOrigin, rayDir);
    const intersects = this.raycaster.intersectObjects(targets, true);

    let endPos = rayOrigin.clone().addScaledVector(rayDir, 120);

    if (intersects.length > 0) {
      const hit = intersects[0];
      endPos = hit.point.clone();

      let targetRemote = null;
      this.remotePlayers.forEach(p => {
        if (p.mesh.getObjectById(hit.object.id) || p.mesh === hit.object) {
          targetRemote = p;
        }
      });

      if (targetRemote) {
        // Prevent friendly fire in TDM
        if (this.gameMode === 'TDM' && this.team === targetRemote.team) {
          return;
        }

        const isHeadshot = hit.object === targetRemote.headMesh;
        const damage = w.damage * (isHeadshot ? w.headshotMult : 1.0);

        this.particles.createImpact(hit.point, hit.face.normal, true);
        this.triggerHitmarker(isHeadshot);

        this.socket.emit('deal_damage', {
          targetId: targetRemote.id,
          damage,
          isHeadshot
        });
      } else {
        this.particles.createImpact(hit.point, hit.face.normal, false);
      }
    }

    this.particles.createTracer(
      new THREE.Vector3().copy(rayOrigin).add(new THREE.Vector3(0.2, -0.2, -0.5).applyQuaternion(this.camera.quaternion)),
      endPos
    );

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

  updateTDMScore(scores) {
    if (scores) {
      document.getElementById('score-alpha').textContent = scores.alpha;
      document.getElementById('score-bravo').textContent = scores.bravo;
    }
  }

  addKillFeed(text) {
    const feed = document.getElementById('killfeed');
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.textContent = text;
    feed.appendChild(entry);

    setTimeout(() => entry.remove(), 4500);
  }

  updateRadar() {
    this.radarCtx.clearRect(0, 0, 130, 130);
    const center = 65;
    const scale = 0.8;

    this.radarCtx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    this.radarCtx.beginPath();
    this.radarCtx.arc(center, center, 60, 0, Math.PI * 2);
    this.radarCtx.stroke();

    // Player dot (Center Green)
    this.radarCtx.fillStyle = '#10b981';
    this.radarCtx.beginPath();
    this.radarCtx.arc(center, center, 4, 0, Math.PI * 2);
    this.radarCtx.fill();

    // Real Online Human Players on Radar
    this.remotePlayers.forEach(p => {
      const dx = (p.position.x - this.player.position.x) * scale;
      const dz = (p.position.z - this.player.position.z) * scale;

      const rx = center + dx;
      const ry = center + dz;

      if (Math.hypot(dx, dz) < 58) {
        this.radarCtx.fillStyle = p.team === 'alpha' ? '#00f0ff' : p.team === 'bravo' ? '#ff007f' : '#ef4444';
        this.radarCtx.beginPath();
        this.radarCtx.arc(rx, ry, 4, 0, Math.PI * 2);
        this.radarCtx.fill();
      }
    });
  }

  updateLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    const list = [
      { name: this.username, team: this.team.toUpperCase(), kills: this.kills, deaths: this.deaths, hp: Math.round(this.health) }
    ];

    this.remotePlayers.forEach(p => {
      list.push({ name: p.username, team: (p.team || 'FFA').toUpperCase(), kills: 0, deaths: 0, hp: 100 });
    });

    list.sort((a, b) => b.kills - a.kills);

    list.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.team}</td>
        <td>${item.kills}</td>
        <td>${item.deaths}</td>
        <td>${item.hp}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- RACING KEY LISTENERS ---
  initRaceKeyListeners() {
    this._raceKeyDown = (e) => {
      if (!this.isRacing) return;
      switch(e.code) {
        case 'KeyW': this.raceKeys.forward = true; break;
        case 'KeyS': this.raceKeys.backward = true; break;
        case 'KeyA': this.raceKeys.left = true; break;
        case 'KeyD': this.raceKeys.right = true; break;
        case 'Space': this.raceKeys.drift = true; break;
        case 'ShiftLeft': this.raceKeys.nitro = true; break;
      }
    };
    this._raceKeyUp = (e) => {
      if (!this.isRacing) return;
      switch(e.code) {
        case 'KeyW': this.raceKeys.forward = false; break;
        case 'KeyS': this.raceKeys.backward = false; break;
        case 'KeyA': this.raceKeys.left = false; break;
        case 'KeyD': this.raceKeys.right = false; break;
        case 'Space': this.raceKeys.drift = false; break;
        case 'ShiftLeft': this.raceKeys.nitro = false; break;
      }
    };
    window.addEventListener('keydown', this._raceKeyDown);
    window.addEventListener('keyup', this._raceKeyUp);
  }

  // --- RACING SOCKET EVENTS ---
  initRaceSocketEvents() {
    this.socket.on('racer_joined', (data) => {
      if (this.racingMode && data.id !== this.socket.id) {
        this.racingMode.spawnRemoteRacer(data.id, data.color || '#ff007f');
      }
    });

    this.socket.on('racer_moved', (data) => {
      if (this.racingMode && data.id !== this.socket.id) {
        this.racingMode.updateRemoteRacer(data.id, data);
      }
    });

    this.socket.on('racer_left', (data) => {
      if (this.racingMode) {
        this.racingMode.removeRemoteRacer(data.id);
      }
    });

    this.socket.on('race_countdown', (data) => {
      const countdownEl = document.getElementById('race-countdown');
      const textEl = document.getElementById('countdown-text');
      if (data.value > 0) {
        countdownEl.classList.remove('hidden');
        textEl.textContent = data.value;
      } else {
        textEl.textContent = 'GO!';
        setTimeout(() => countdownEl.classList.add('hidden'), 800);
        if (this.racingMode) {
          this.racingMode.raceActive = true;
          this.racingMode.raceTime = 0;
        }
      }
    });

    this.socket.on('race_result', (data) => {
      document.getElementById('race-finish-screen').classList.remove('hidden');
      document.getElementById('race-final-time').textContent = data.time || '0:00.0';
      const rankEl = document.getElementById('race-ranking');
      if (data.rankings) {
        rankEl.innerHTML = data.rankings.map((r, i) =>
          `<div style="margin:4px 0;color:${i===0?'#10b981':'#94a3b8'}">${i+1}. ${r.username} - ${r.time}</div>`
        ).join('');
      }
    });
  }

  // --- RACE HUD UPDATE ---
  updateRaceHUD() {
    if (!this.racingMode) return;
    const state = this.racingMode.getState();
    document.getElementById('race-speed').textContent = Math.round(Math.abs(state.speed) * 3.6);
    document.getElementById('race-lap').textContent = Math.min(state.lap + 1, 3);
    document.getElementById('race-checkpoint').textContent = state.checkpoint;
    document.getElementById('race-total-cp').textContent = this.racingMode.checkpoints.length;

    const totalSec = state.raceTime || 0;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1);
    document.getElementById('race-time').textContent = `${mins}:${secs.padStart(4, '0')}`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.isPlaying && this.isRacing && this.racingMode) {
      // --- RACING ANIMATE ---
      this.racingMode.update(delta, this.raceKeys);
      this.gameScene.update(delta);
      this.updateRaceHUD();

      // Send race position to server
      if (this.socket && this.socket.connected) {
        const state = this.racingMode.getState();
        this.socket.emit('race_update', {
          x: state.position.x,
          y: state.position.y,
          z: state.position.z,
          rotY: state.rotation,
          speed: state.speed
        });
      }
    } else if (this.isPlaying && !this.isShopOpen) {
      // --- FPS ANIMATE ---
      this.player.update(delta);
      this.weapons.update(delta);
      this.particles.update(delta);
      this.gameScene.update(delta);

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

      this.remotePlayers.forEach(p => {
        p.position.lerp(p.targetPos, delta * 14);
        p.mesh.rotation.y = THREE.MathUtils.lerp(p.mesh.rotation.y, p.targetRotY, delta * 14);
      });

      this.updateRadar();
    }

    this.renderer.render(this.gameScene.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
