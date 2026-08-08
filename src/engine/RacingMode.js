import * as THREE from 'three';

export class RacingMode {
  constructor(scene, camera, socket) {
    this.scene = scene;
    this.camera = camera;
    this.socket = socket;
    
    this.car = null;
    this.wheels = [];
    this.checkpoints = [];
    this.barriers = [];
    this.gates = [];
    this.arrows = [];
    
    this.remoteRacers = new Map();
    
    // Physics state
    this.speed = 0;
    this.maxSpeed = 120;
    this.steerAngle = 0;
    this.maxSteer = 0.6;
    
    // Race state
    this.currentCheckpoint = 0;
    this.lap = 0;
    this.totalLaps = 3;
    this.raceActive = false;
    this.raceTime = 0;
    
    this.textureLoader = new THREE.TextureLoader();
    
    // Config
    this.checkpointRadius = 8;
  }
  
  createCarModel(color) {
    const carGroup = new THREE.Group();
    this.wheels = [];

    // Load textures
    const bodyTex = this.textureLoader.load('/textures/car_body.jpeg');
    const carbonTex = this.textureLoader.load('/textures/car_carbon.jpeg');
    const glassTex = this.textureLoader.load('/textures/car_glass.jpeg');
    const tyreTex = this.textureLoader.load('/textures/car_tyre.jpeg');
    
    bodyTex.colorSpace = THREE.SRGBColorSpace;
    carbonTex.colorSpace = THREE.SRGBColorSpace;
    glassTex.colorSpace = THREE.SRGBColorSpace;
    tyreTex.colorSpace = THREE.SRGBColorSpace;

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({ 
      map: bodyTex,
      color: color || 0xffffff,
      roughness: 0.2,
      metalness: 0.8
    });
    
    const carbonMat = new THREE.MeshStandardMaterial({
      map: carbonTex,
      roughness: 0.6,
      metalness: 0.3
    });
    
    const glassMat = new THREE.MeshStandardMaterial({
      map: glassTex,
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.7
    });
    
    const tyreMat = new THREE.MeshStandardMaterial({
      map: tyreTex,
      roughness: 0.9,
      metalness: 0.1
    });

    // Main Body
    const bodyGeom = new THREE.BoxGeometry(1.9, 0.6, 4.5);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.6;
    carGroup.add(body);
    
    // Cabin (Windshield / Rear Window)
    const cabinGeom = new THREE.BoxGeometry(1.5, 0.5, 2.0);
    const cabin = new THREE.Mesh(cabinGeom, glassMat);
    cabin.position.set(0, 1.15, -0.2);
    carGroup.add(cabin);

    // Hood (Carbon)
    const hoodGeom = new THREE.BoxGeometry(1.7, 0.1, 1.2);
    const hood = new THREE.Mesh(hoodGeom, carbonMat);
    hood.position.set(0, 0.95, 1.5);
    carGroup.add(hood);

    // Spoiler
    const spoilerStrutGeom = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const strutL = new THREE.Mesh(spoilerStrutGeom, carbonMat);
    strutL.position.set(-0.6, 1.0, -2.0);
    const strutR = new THREE.Mesh(spoilerStrutGeom, carbonMat);
    strutR.position.set(0.6, 1.0, -2.0);
    
    const spoilerWingGeom = new THREE.BoxGeometry(1.8, 0.05, 0.4);
    const spoilerWing = new THREE.Mesh(spoilerWingGeom, carbonMat);
    spoilerWing.position.set(0, 1.15, -2.0);
    
    carGroup.add(strutL, strutR, spoilerWing);

    // Wheels
    const wheelRadius = 0.4;
    const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.3, 32);
    wheelGeom.rotateZ(Math.PI / 2);
    
    const wheelPositions = [
      { x: 1.05, y: 0.4, z: 1.4 },  // Front Left
      { x: -1.05, y: 0.4, z: 1.4 }, // Front Right
      { x: 1.05, y: 0.4, z: -1.5 }, // Rear Left
      { x: -1.05, y: 0.4, z: -1.5 } // Rear Right
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeom, tyreMat);
      wheel.position.set(pos.x, pos.y, pos.z);
      carGroup.add(wheel);
      this.wheels.push(wheel);
    });

    // Headlights
    const hlGeom = new THREE.BoxGeometry(0.4, 0.15, 0.1);
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2
    });
    
    const hlLeft = new THREE.Mesh(hlGeom, hlMat);
    hlLeft.position.set(0.6, 0.7, 2.25);
    const hlRight = new THREE.Mesh(hlGeom, hlMat);
    hlRight.position.set(-0.6, 0.7, 2.25);
    carGroup.add(hlLeft, hlRight);

    // Taillights
    const tlGeom = new THREE.BoxGeometry(0.4, 0.15, 0.1);
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1
    });
    
    const tlLeft = new THREE.Mesh(tlGeom, tlMat);
    tlLeft.position.set(0.6, 0.7, -2.25);
    const tlRight = new THREE.Mesh(tlGeom, tlMat);
    tlRight.position.set(-0.6, 0.7, -2.25);
    carGroup.add(tlLeft, tlRight);

    // Headlight PointLights
    const plLeft = new THREE.PointLight(0xffffff, 2, 20);
    plLeft.position.set(0.6, 0.7, 2.5);
    const plRight = new THREE.PointLight(0xffffff, 2, 20);
    plRight.position.set(-0.6, 0.7, 2.5);
    carGroup.add(plLeft, plRight);
    
    // Neon underglow
    const glowGeom = new THREE.PlaneGeometry(1.6, 4.0);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const underglow = new THREE.Mesh(glowGeom, glowMat);
    underglow.rotation.x = Math.PI / 2;
    underglow.position.y = 0.05; // slightly above ground
    carGroup.add(underglow);
    
    const glowLight = new THREE.PointLight(0x00ffff, 1, 10);
    glowLight.position.y = 0.1;
    carGroup.add(glowLight);
    
    return carGroup;
  }
  
  buildRaceTrack() {
    this.checkpoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 100),
      new THREE.Vector3(0, 0, 200),
      new THREE.Vector3(50, 0, 300),
      new THREE.Vector3(150, 0, 300),
      new THREE.Vector3(250, 0, 300),
      new THREE.Vector3(300, 0, 250),
      new THREE.Vector3(300, 0, 150),
      new THREE.Vector3(250, 0, 50),
      new THREE.Vector3(150, 0, 0),
      new THREE.Vector3(50, 0, 0)
    ];

    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.5
    });
    
    const startGateMat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 2.0
    });

    const pillarGeom = new THREE.BoxGeometry(1, 10, 1);
    
    this.checkpoints.forEach((pos, index) => {
      const isStart = index === 0;
      const mat = isStart ? startGateMat : gateMat;
      const width = isStart ? 30 : 20;
      
      const gateGroup = new THREE.Group();
      gateGroup.position.copy(pos);
      
      // Calculate rotation towards next checkpoint
      const nextPos = this.checkpoints[(index + 1) % this.checkpoints.length];
      const dir = new THREE.Vector3().subVectors(nextPos, pos).normalize();
      gateGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      
      const leftPillar = new THREE.Mesh(pillarGeom, mat);
      leftPillar.position.set(-width/2, 5, 0);
      
      const rightPillar = new THREE.Mesh(pillarGeom, mat);
      rightPillar.position.set(width/2, 5, 0);
      
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 1, 1), mat);
      beam.position.set(0, 10.5, 0);
      
      gateGroup.add(leftPillar, rightPillar, beam);
      this.scene.add(gateGroup);
      this.gates.push(gateGroup);
      
      // Add arrow indicator
      const arrowGeom = new THREE.ConeGeometry(2, 4, 3);
      arrowGeom.rotateX(Math.PI / 2); // Lay flat
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const arrow = new THREE.Mesh(arrowGeom, arrowMat);
      
      // Place arrow halfway to next checkpoint
      const arrowPos = new THREE.Vector3().lerpVectors(pos, nextPos, 0.5);
      arrow.position.copy(arrowPos);
      arrow.position.y = 0.1;
      
      const arrowDir = new THREE.Vector3().subVectors(nextPos, arrowPos).normalize();
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), arrowDir);
      
      this.scene.add(arrow);
      this.arrows.push(arrow);
    });
    
    return this.checkpoints;
  }
  
  updateCarPhysics(delta, keys) {
    if (!this.car) return;

    let accel = 0;
    let braking = false;
    let drifting = keys[' '] ? true : false;
    let nitro = keys['Shift'] ? 1.5 : 1.0;
    
    if (keys['w'] || keys['W']) accel = 60 * nitro;
    if (keys['s'] || keys['S']) {
      if (this.speed > 0) braking = true;
      accel = -30;
    }
    
    // Friction and drag
    if (accel === 0) {
      this.speed *= (1 - 2 * delta); // natural slowdown
      if (Math.abs(this.speed) < 1) this.speed = 0;
    } else {
      if (braking) {
        this.speed -= 100 * delta; // hard brake
      } else {
        this.speed += accel * delta;
      }
    }
    
    // Drift modifies speed slightly
    if (drifting && Math.abs(this.speed) > 20) {
      this.speed *= (1 - 0.5 * delta);
    }
    
    // Clamp speed
    this.speed = Math.max(-30, Math.min(this.speed, this.maxSpeed));
    
    // Steering
    let steerInput = 0;
    if (keys['a'] || keys['A']) steerInput = 1;
    if (keys['d'] || keys['D']) steerInput = -1;
    
    // Target steer angle
    const targetSteer = steerInput * this.maxSteer;
    this.steerAngle += (targetSteer - this.steerAngle) * 10 * delta;
    
    if (Math.abs(this.speed) > 1) {
      const turnMultiplier = drifting ? 2.0 : 1.0;
      const turnSpeed = this.steerAngle * (this.speed / this.maxSpeed) * 3 * turnMultiplier;
      this.car.rotation.y += turnSpeed * delta;
    }
    
    // Apply velocity
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.quaternion);
    this.car.position.add(forward.multiplyScalar(this.speed * delta));
    this.car.position.y = 0; // Keep on ground
    
    // Rotate wheels
    const wheelRotSpeed = (this.speed / 0.4) * delta; // speed / radius
    this.wheels.forEach((wheel, index) => {
      // Front wheels steer
      if (index < 2) {
        wheel.rotation.y = this.steerAngle;
      } else {
        wheel.rotation.y = 0;
      }
      wheel.rotateX(wheelRotSpeed);
    });
  }
  
  updateChaseCamera(delta) {
    if (!this.car) return;
    
    // Calculate dynamic offset based on speed
    const speedRatio = this.speed / this.maxSpeed;
    const zOffset = -8 - (speedRatio * 4); // pull back more at high speeds
    const yOffset = 5 + (speedRatio * 1);
    
    const idealOffset = new THREE.Vector3(0, yOffset, zOffset);
    idealOffset.applyQuaternion(this.car.quaternion);
    idealOffset.add(this.car.position);
    
    const idealLookAt = new THREE.Vector3(0, 0, 5);
    idealLookAt.applyQuaternion(this.car.quaternion);
    idealLookAt.add(this.car.position);
    
    this.camera.position.lerp(idealOffset, 5 * delta);
    
    // Create a dummy object to lerp the lookAt
    if (!this.cameraLookAt) this.cameraLookAt = new THREE.Vector3().copy(idealLookAt);
    this.cameraLookAt.lerp(idealLookAt, 10 * delta);
    this.camera.lookAt(this.cameraLookAt);
  }
  
  startRace() {
    if (!this.car) {
      this.car = this.createCarModel(0xffffff);
      this.scene.add(this.car);
    }
    
    this.buildRaceTrack();
    
    const startPos = this.checkpoints[0];
    this.car.position.copy(startPos);
    // Determine start rotation (facing checkpoint 1)
    if (this.checkpoints.length > 1) {
      const nextPos = this.checkpoints[1];
      const dir = new THREE.Vector3().subVectors(nextPos, startPos).normalize();
      this.car.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    }
    
    this.speed = 0;
    this.currentCheckpoint = 1; // Looking for the next one
    this.lap = 1;
    this.raceTime = 0;
    this.raceActive = true;
  }
  
  checkCheckpoints() {
    if (!this.car || !this.raceActive) return;
    
    const nextCp = this.checkpoints[this.currentCheckpoint];
    if (!nextCp) return;
    
    const dist = this.car.position.distanceTo(nextCp);
    if (dist < this.checkpointRadius) {
      this.currentCheckpoint++;
      
      if (this.currentCheckpoint >= this.checkpoints.length) {
        this.currentCheckpoint = 0;
        this.lap++;
        
        if (this.lap > this.totalLaps) {
          this.raceActive = false;
          console.log(`Race Finished! Time: ${this.raceTime.toFixed(2)}s`);
        }
      }
    }
  }
  
  update(delta, keys) {
    if (!this.car) return;
    
    if (this.raceActive) {
      this.raceTime += delta;
      this.updateCarPhysics(delta, keys);
      this.checkCheckpoints();
      this.updateChaseCamera(delta);
    }
    
    // Interpolate remote racers
    for (const [id, remote] of this.remoteRacers.entries()) {
      if (remote.mesh && remote.targetPos) {
        remote.mesh.position.lerp(remote.targetPos, 10 * delta);
        
        // Simple quaternion slerp for rotation
        const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, remote.targetRotY, 0));
        remote.mesh.quaternion.slerp(targetQuat, 10 * delta);
        
        // Rotate remote wheels based on movement
        const moveDist = remote.mesh.position.distanceTo(remote.lastPos || remote.mesh.position);
        remote.lastPos = remote.mesh.position.clone();
        
        const remoteSpeed = moveDist / delta;
        const remoteRotSpeed = (remoteSpeed / 0.4) * delta;
        
        if (remote.wheels) {
           remote.wheels.forEach(w => w.rotateX(remoteRotSpeed));
        }
      }
    }
  }
  
  dispose() {
    if (this.car) {
      this.scene.remove(this.car);
      this.car = null;
    }
    
    this.gates.forEach(g => this.scene.remove(g));
    this.arrows.forEach(a => this.scene.remove(a));
    this.gates = [];
    this.arrows = [];
    
    for (const [id, remote] of this.remoteRacers.entries()) {
      this.removeRemoteRacer(id);
    }
  }
  
  getState() {
    if (!this.car) return null;
    return {
      position: { x: this.car.position.x, y: this.car.position.y, z: this.car.position.z },
      rotationY: this.car.rotation.y,
      speed: this.speed,
      lap: this.lap,
      checkpoint: this.currentCheckpoint,
      time: this.raceTime
    };
  }
  
  spawnRemoteRacer(id, color) {
    // Hack: to get wheels ref for remote, we could modify createCarModel to return it or just find by name.
    // For now we'll just save the previous wheels array temporarily
    const previousWheels = this.wheels;
    
    const mesh = this.createCarModel(color);
    this.scene.add(mesh);
    
    this.remoteRacers.set(id, {
      mesh: mesh,
      wheels: this.wheels, // grab the wheels generated for this car
      targetPos: new THREE.Vector3(),
      targetRotY: 0,
      lastPos: new THREE.Vector3()
    });
    
    // restore local wheels
    this.wheels = previousWheels;
  }
  
  updateRemoteRacer(id, data) {
    const remote = this.remoteRacers.get(id);
    if (remote && data.position) {
      remote.targetPos.set(data.position.x, data.position.y, data.position.z);
      if (data.rotationY !== undefined) {
        remote.targetRotY = data.rotationY;
      }
    }
  }
  
  removeRemoteRacer(id) {
    const remote = this.remoteRacers.get(id);
    if (remote && remote.mesh) {
      this.scene.remove(remote.mesh);
    }
    this.remoteRacers.delete(id);
  }
}
