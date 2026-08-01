import * as THREE from 'three';

export class ParticleFX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
  }

  // Create glowing line tracer from barrel to impact
  createTracer(startPos, endPos) {
    const points = [startPos, endPos];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });

    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.tracers.push({
      mesh: line,
      life: 0.08 // seconds
    });
  }

  // Create blood or spark impact burst
  createImpact(pos, normal, isBlood = false) {
    const count = isBlood ? 12 : 8;
    const color = isBlood ? 0xef4444 : 0xfacc15;
    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);

      // Random direction biased towards surface normal
      const velocity = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * 1.5,
        normal.y + (Math.random() - 0.5) * 1.5,
        normal.z + (Math.random() - 0.5) * 1.5
      ).normalize().multiplyScalar(isBlood ? 4 + Math.random() * 4 : 6 + Math.random() * 6);

      this.scene.add(p);

      this.particles.push({
        mesh: p,
        velocity,
        gravity: isBlood ? 12 : 18,
        life: 0.25 + Math.random() * 0.15,
        maxLife: 0.4
      });
    }
  }

  update(delta) {
    // Update line tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      t.mesh.material.opacity = Math.max(0, t.life / 0.08);

      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update particle bursts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      // Apply velocity and gravity
      p.velocity.y -= p.gravity * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Scale down near end of life
      const scale = Math.max(0, p.life / p.maxLife);
      p.mesh.scale.set(scale, scale, scale);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
