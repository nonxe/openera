import * as THREE from 'three';

export class BotManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.bots = new Map();
  }

  spawnBot(id, username, x, y, z, color = '#ff0055') {
    const group = new THREE.Group();

    // Body Mesh (Robotic Soldier)
    const armorMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), armorMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), darkMat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    // Visor Line
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.1), visorMat);
    visor.position.set(0, 1.72, -0.2);
    group.add(visor);

    // Weapon Model Held by Bot
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), darkMat);
    gun.position.set(0.3, 1.0, -0.3);
    group.add(gun);

    group.position.set(x, y, z);
    this.scene.add(group);

    const botData = {
      id,
      username,
      mesh: group,
      headMesh: head,
      position: group.position,
      health: 100,
      maxHealth: 100,
      velocity: new THREE.Vector3(),
      targetPos: new THREE.Vector3(x, y, z),
      stateTimer: 0,
      shootTimer: 0,
      color
    };

    this.bots.set(id, botData);
    return botData;
  }

  update(delta, playerPos, onBotShoot) {
    this.bots.forEach(bot => {
      if (bot.health <= 0) return;

      // Distance to main player
      const distToPlayer = bot.position.distanceTo(playerPos);

      // AI State Machine (Roam vs Attack)
      bot.stateTimer -= delta;
      if (bot.stateTimer <= 0) {
        if (distToPlayer < 40) {
          // Move towards player or flank
          bot.targetPos.copy(playerPos);
          bot.targetPos.x += (Math.random() - 0.5) * 10;
          bot.targetPos.z += (Math.random() - 0.5) * 10;
        } else {
          // Random roam
          bot.targetPos.set((Math.random() - 0.5) * 80, 2, (Math.random() - 0.5) * 80);
        }
        bot.stateTimer = 2 + Math.random() * 3;
      }

      // Move bot towards targetPos
      const dir = new THREE.Vector3().subVectors(bot.targetPos, bot.position);
      dir.y = 0;
      if (dir.lengthSq() > 1) {
        dir.normalize();
        bot.position.x += dir.x * 7 * delta;
        bot.position.z += dir.z * 7 * delta;

        // Face movement / player direction
        bot.mesh.lookAt(playerPos.x, bot.position.y, playerPos.z);
      }

      // Shooting logic when player is in sight
      if (distToPlayer < 35) {
        bot.shootTimer -= delta;
        if (bot.shootTimer <= 0) {
          bot.shootTimer = 0.8 + Math.random() * 0.6; // bot fire rate

          const origin = new THREE.Vector3().copy(bot.position).add(new THREE.Vector3(0, 1.5, 0));
          const shootDir = new THREE.Vector3().subVectors(playerPos, origin).normalize();

          // Add slight bot inaccuracy
          shootDir.x += (Math.random() - 0.5) * 0.15;
          shootDir.y += (Math.random() - 0.5) * 0.15;
          shootDir.z += (Math.random() - 0.5) * 0.15;

          if (onBotShoot) {
            onBotShoot(bot, origin, shootDir);
          }
        }
      }
    });
  }

  removeBot(id) {
    const b = this.bots.get(id);
    if (b) {
      this.scene.remove(b.mesh);
      this.bots.delete(id);
    }
  }
}
