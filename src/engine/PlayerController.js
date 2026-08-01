import * as THREE from 'three';
import { soundEngine } from './Audio.js';

export class PlayerController {
  constructor(camera, domElement, colliders, jumpPads) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;
    this.jumpPads = jumpPads;

    // YXZ Euler order prevents camera roll/tilting
    this.camera.rotation.order = 'YXZ';

    // Position (Feet level) & Eye Height
    this.position = new THREE.Vector3(0, 1, 0);
    this.eyeHeight = 1.6;
    this.crouchEyeHeight = 0.9;
    this.currentEyeHeight = 1.6;

    this.playerRadius = 0.6;
    this.playerHeight = 1.8;

    this.velocity = new THREE.Vector3();
    this.rotation = { yaw: 0, pitch: 0 };

    this.isGrounded = true;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.slideTimer = 0;

    // Movement speeds
    this.walkSpeed = 11;
    this.sprintSpeed = 17;
    this.crouchSpeed = 5.5;
    this.jumpForce = 13.5;
    this.gravity = 32;

    this.sensitivity = 0.002;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false
    };

    this.footstepTimer = 0;
    this.playerBox = new THREE.Box3();
    this.tempBox = new THREE.Box3();

    this.initEventListeners();
  }

  initEventListeners() {
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement) return;

      this.rotation.yaw -= e.movementX * this.sensitivity;
      this.rotation.pitch -= e.movementY * this.sensitivity;

      const maxPitch = Math.PI / 2 - 0.02;
      this.rotation.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.rotation.pitch));

      this.camera.rotation.set(this.rotation.pitch, this.rotation.yaw, 0, 'YXZ');
    });

    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'Space':
          if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            soundEngine.playJump();
          }
          this.keys.jump = true;
          break;
        case 'ShiftLeft': this.keys.sprint = true; break;
        case 'KeyC':
        case 'ControlLeft':
          if (!this.isCrouching && this.keys.sprint && this.isGrounded) {
            this.isSliding = true;
            this.slideTimer = 0.5;
            this.velocity.x *= 1.35;
            this.velocity.z *= 1.35;
          }
          this.keys.crouch = true;
          this.isCrouching = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = false; break;
        case 'KeyS': this.keys.backward = false; break;
        case 'KeyA': this.keys.left = false; break;
        case 'KeyD': this.keys.right = false; break;
        case 'Space': this.keys.jump = false; break;
        case 'ShiftLeft': this.keys.sprint = false; break;
        case 'KeyC':
        case 'ControlLeft':
          this.keys.crouch = false;
          this.isCrouching = false;
          this.isSliding = false;
          break;
      }
    });
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.camera.position.set(x, y + this.currentEyeHeight, z);
  }

  // Robust AABB Horizontal Wall Collision Resolution
  resolveWallCollisions() {
    const pRadius = this.playerRadius;
    const pHeight = (this.isCrouching || this.isSliding) ? 1.0 : this.playerHeight;

    // Create player AABB
    this.playerBox.min.set(
      this.position.x - pRadius,
      this.position.y + 0.1,
      this.position.z - pRadius
    );
    this.playerBox.max.set(
      this.position.x + pRadius,
      this.position.y + pHeight,
      this.position.z + pRadius
    );

    for (let i = 0; i < this.colliders.length; i++) {
      const colMesh = this.colliders[i];
      if (!colMesh.geometry) continue;

      // Compute bounding box for collider
      if (!colMesh.geometry.boundingBox) {
        colMesh.geometry.computeBoundingBox();
      }

      this.tempBox.copy(colMesh.geometry.boundingBox).applyMatrix4(colMesh.matrixWorld);

      // Skip ground floor slab from horizontal wall push
      if (this.tempBox.max.y <= this.position.y + 0.2) continue;

      if (this.playerBox.intersectsBox(this.tempBox)) {
        // Calculate penetration depth along X and Z axes
        const overlapX1 = this.tempBox.max.x - this.playerBox.min.x;
        const overlapX2 = this.playerBox.max.x - this.tempBox.min.x;
        const overlapZ1 = this.tempBox.max.z - this.playerBox.min.z;
        const overlapZ2 = this.playerBox.max.z - this.tempBox.min.z;

        const overlapX = Math.min(overlapX1, overlapX2);
        const overlapZ = Math.min(overlapZ1, overlapZ2);

        // Step-up check (allows stepping over low obstacles like curbs/stairs)
        const stepHeight = this.tempBox.max.y - this.position.y;
        if (stepHeight > 0 && stepHeight <= 0.6 && this.isGrounded) {
          this.position.y = this.tempBox.max.y;
          continue;
        }

        // Push out along minimum overlap axis
        if (overlapX < overlapZ) {
          if (overlapX1 < overlapX2) {
            this.position.x += overlapX;
          } else {
            this.position.x -= overlapX;
          }
          this.velocity.x = 0;
        } else {
          if (overlapZ1 < overlapZ2) {
            this.position.z += overlapZ;
          } else {
            this.position.z -= overlapZ;
          }
          this.velocity.z = 0;
        }

        // Recalculate player box after push out
        this.playerBox.min.set(
          this.position.x - pRadius,
          this.position.y + 0.1,
          this.position.z - pRadius
        );
        this.playerBox.max.set(
          this.position.x + pRadius,
          this.position.y + pHeight,
          this.position.z + pRadius
        );
      }
    }
  }

  update(delta) {
    // Smooth eye height crouching transition
    const targetEyeHeight = (this.isCrouching || this.isSliding) ? this.crouchEyeHeight : this.eyeHeight;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetEyeHeight, delta * 12);

    // Direction vector relative to camera yaw
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;

    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.yaw);

    // Speed selection
    let targetSpeed = this.walkSpeed;
    if (this.isCrouching) targetSpeed = this.crouchSpeed;
    else if (this.keys.sprint && this.keys.forward) targetSpeed = this.sprintSpeed;

    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    // Acceleration & Friction
    if (moveDir.lengthSq() > 0 && !this.isSliding) {
      const accel = this.isGrounded ? 14 : 4;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDir.x * targetSpeed, delta * accel);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDir.z * targetSpeed, delta * accel);

      if (this.isGrounded && !this.isCrouching) {
        this.footstepTimer += delta;
        const interval = this.keys.sprint ? 0.28 : 0.4;
        if (this.footstepTimer >= interval) {
          soundEngine.playFootstep();
          this.footstepTimer = 0;
        }
      }
    } else if (!this.isSliding) {
      const friction = this.isGrounded ? 15 : 1.5;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * friction);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * friction);
    }

    // Gravity
    this.velocity.y -= this.gravity * delta;

    // 1. Move Position horizontally
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // 2. Resolve Horizontal Wall Collisions (STOPS PLAYERS FROM WALKING THROUGH BUILDINGS/CRATES!)
    this.resolveWallCollisions();

    // 3. Move Position vertically
    this.position.y += this.velocity.y * delta;

    // 4. Raycast Ground Collision (Cast down 1.2m from feet + 0.5m)
    const rayOrigin = new THREE.Vector3(this.position.x, this.position.y + 0.5, this.position.z);
    const raycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 1.2);
    const intersects = raycaster.intersectObjects(this.colliders, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const groundY = hit.point.y;

      if (this.position.y <= groundY + 0.1) {
        this.position.y = groundY;
        this.velocity.y = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    } else if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Check Jump Pads
    this.jumpPads.forEach(pad => {
      const dist = new THREE.Vector2(this.position.x - pad.position.x, this.position.z - pad.position.z).length();
      if (dist < 2.5 && Math.abs(this.position.y - pad.position.y) < 1.5) {
        this.velocity.y = 25;
        this.isGrounded = false;
        soundEngine.playJump();
      }
    });

    // Map Outer Boundary Clamping
    const limit = 150;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);

    // Sync camera position
    this.camera.position.set(this.position.x, this.position.y + this.currentEyeHeight, this.position.z);
  }
}
