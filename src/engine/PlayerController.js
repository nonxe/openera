import * as THREE from 'three';
import { soundEngine } from './Audio.js';

export class PlayerController {
  constructor(camera, domElement, colliders, jumpPads) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;
    this.jumpPads = jumpPads;

    // Movement state
    this.position = new THREE.Vector3(0, 3, 0);
    this.velocity = new THREE.Vector3();
    this.rotation = { yaw: 0, pitch: 0 };
    this.isGrounded = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.slideTimer = 0;

    // Movement Parameters (deadshot.io style fluid movement)
    this.walkSpeed = 12;
    this.sprintSpeed = 18;
    this.crouchSpeed = 6;
    this.jumpForce = 14;
    this.gravity = 35;
    this.playerHeight = 1.8;
    this.crouchHeight = 1.0;
    this.radius = 0.5;

    // Mouse sensitivity
    this.sensitivity = 0.002;

    // Keyboard inputs
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

    this.initEventListeners();
  }

  initEventListeners() {
    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement) return;

      this.rotation.yaw -= e.movementX * this.sensitivity;
      this.rotation.pitch -= e.movementY * this.sensitivity;

      // Clamp pitch to prevent camera flips
      this.rotation.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.rotation.pitch));

      this.camera.rotation.set(0, 0, 0);
      this.camera.rotation.y = this.rotation.yaw;
      this.camera.rotation.x = this.rotation.pitch;
    });

    // Key Down
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'Space':
          if (!this.keys.jump && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            soundEngine.playJump();
          }
          this.keys.jump = true;
          break;
        case 'ShiftLeft': this.keys.sprint = true; break;
        case 'KeyC':
        case 'ControlLeft':
          if (!this.keys.crouch && this.keys.sprint && this.isGrounded) {
            // Trigger slide mechanic!
            this.isSliding = true;
            this.slideTimer = 0.6;
            this.velocity.x *= 1.4;
            this.velocity.z *= 1.4;
          }
          this.keys.crouch = true;
          this.isCrouching = true;
          break;
      }
    });

    // Key Up
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

  update(delta) {
    // Determine movement direction vector based on camera yaw
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;

    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.yaw);

    // Current speed mode
    let targetSpeed = this.walkSpeed;
    if (this.isCrouching) targetSpeed = this.crouchSpeed;
    else if (this.keys.sprint && this.keys.forward) targetSpeed = this.sprintSpeed;

    // Slide logic
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // Accelerate horizontal velocity
    if (moveDir.lengthSq() > 0 && !this.isSliding) {
      const currentHorizSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
      const accelRate = this.isGrounded ? 12 : 3; // air control
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDir.x * targetSpeed, delta * accelRate);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDir.z * targetSpeed, delta * accelRate);

      // Footstep audio when moving on ground
      if (this.isGrounded && !this.isCrouching) {
        this.footstepTimer += delta;
        const stepInterval = this.keys.sprint ? 0.28 : 0.42;
        if (this.footstepTimer >= stepInterval) {
          soundEngine.playFootstep();
          this.footstepTimer = 0;
        }
      }
    } else if (!this.isSliding) {
      // Friction slowdown
      const friction = this.isGrounded ? 14 : 1;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * friction);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * friction);
    }

    // Gravity
    this.velocity.y -= this.gravity * delta;

    // Apply potential position move
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    // Simple Ground Raycast Collision
    const raycaster = new THREE.Raycaster(this.position, new THREE.Vector3(0, -1, 0), 0, 3);
    const intersects = raycaster.intersectObjects(this.colliders, false);

    const currentTargetHeight = (this.isCrouching || this.isSliding) ? this.crouchHeight : this.playerHeight;

    if (intersects.length > 0) {
      const hit = intersects[0];
      const groundY = hit.point.y + currentTargetHeight;

      if (this.position.y <= groundY + 0.1) {
        this.position.y = groundY;
        this.velocity.y = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    } else {
      this.isGrounded = false;
    }

    // Check Jump Pad Boost Collision
    this.jumpPads.forEach(pad => {
      const dist = new THREE.Vector2(this.position.x - pad.position.x, this.position.z - pad.position.z).length();
      if (dist < 2.5 && Math.abs(this.position.y - pad.position.y) < 2) {
        this.velocity.y = 26; // High launch!
        this.isGrounded = false;
        soundEngine.playJump();
      }
    });

    // Clamp boundary
    const limit = 58;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);

    // Sync camera position
    this.camera.position.copy(this.position);
  }
}
