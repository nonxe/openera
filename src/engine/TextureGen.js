import * as THREE from 'three';

// Procedural Canvas Texture Generator for High Graphics
export class TextureGen {
  // 1. Asphalt Road Texture with Lane Lines
  static createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Asphalt Base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    // Noise Grain
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 25;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Yellow Center Lines
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12;
    ctx.setLineDash([40, 30]);
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();

    // White Edge Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(32, 512);
    ctx.moveTo(480, 0);
    ctx.lineTo(480, 512);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // 2. Building Concrete & Window Glass Grid Texture
  static createBuildingTexture(wallColor = '#334155', windowColor = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Wall Base
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle Noise
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 15;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Window Grid Panels
    const rows = 8;
    const cols = 8;
    const w = 36;
    const h = 48;
    const gapX = 24;
    const gapY = 16;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 20 + c * (w + gapX);
        const y = 20 + r * (h + gapY);

        // Random illuminated vs dark window
        const isLit = Math.random() > 0.35;
        if (isLit) {
          const grad = ctx.createLinearGradient(x, y, x, y + h);
          grad.addColorStop(0, '#7dd3fc');
          grad.addColorStop(1, windowColor);
          ctx.fillStyle = grad;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, y, w, h);
        ctx.shadowBlur = 0;

        // Window Frame Border
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // 3. Corrugated Metal Container Texture
  static createContainerTexture(baseColor = '#b91c1c') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);

    // Vertical Rib Corrugation
    for (let x = 0; x < 256; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 256);
    }

    // Container Corner Frame
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // 4. Wood Texture for AK-47 Stock
  static createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#78350f');
    grad.addColorStop(0.5, '#92400e');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Wood Grain lines
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + (Math.random() - 0.5) * 20, 160, y + (Math.random() - 0.5) * 20, 256, y);
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }

  // 5. Gun Metal Texture
  static createGunMetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 256);

    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    return new THREE.CanvasTexture(canvas);
  }
}
