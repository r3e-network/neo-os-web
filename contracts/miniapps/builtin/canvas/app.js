/**
 * Pixel Canvas MiniApp
 * Collaborative 1920x1080 canvas with daily NFT snapshots
 */

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const PIXEL_PRICE = 1000; // datoshi
const GAS_DECIMALS = 100000000;

class PixelCanvas {
  constructor() {
    this.canvas = document.getElementById("main-canvas");
    this.preview = document.getElementById("preview-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.previewCtx = this.preview.getContext("2d");

    this.zoom = 0.5;
    this.color = { r: 0, g: 0, b: 0 };
    this.brushSize = 1;
    this.isDrawing = false;
    this.pendingPixels = new Map();
    this.uploadedImage = null;

    this.init();
  }

  init() {
    this.setupCanvas();
    this.bindEvents();
    this.updateZoom();
    this.updateNFTCountdown();
    setInterval(() => this.updateNFTCountdown(), 1000);
  }

  setupCanvas() {
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  bindEvents() {
    // Color picker
    const colorInput = document.getElementById("color-input");
    colorInput.addEventListener("input", (e) => {
      const hex = e.target.value;
      this.color = this.hexToRgb(hex);
      document.getElementById("rgb-display").textContent = `RGB(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    });

    // Brush size
    document.getElementById("brush-size").addEventListener("change", (e) => {
      this.brushSize = parseInt(e.target.value);
    });

    // Tool buttons
    document.getElementById("btn-draw").addEventListener("click", () => {
      this.setTool("draw");
    });

    document.getElementById("btn-upload").addEventListener("click", () => {
      this.setTool("upload");
    });

    document.getElementById("btn-clear").addEventListener("click", () => {
      this.clearPending();
    });

    // Canvas drawing
    this.canvas.addEventListener("mousedown", (e) => this.startDraw(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDraw());
    this.canvas.addEventListener("mouseleave", () => this.stopDraw());

    // Zoom controls
    document.getElementById("zoom-in").addEventListener("click", () => {
      this.zoom = Math.min(4, this.zoom + 0.25);
      this.updateZoom();
    });

    document.getElementById("zoom-out").addEventListener("click", () => {
      this.zoom = Math.max(0.1, this.zoom - 0.25);
      this.updateZoom();
    });

    document.getElementById("zoom-fit").addEventListener("click", () => {
      const wrapper = document.querySelector(".canvas-wrapper");
      this.zoom = Math.min(wrapper.clientWidth / CANVAS_WIDTH, wrapper.clientHeight / CANVAS_HEIGHT);
      this.updateZoom();
    });

    // Image upload
    document.getElementById("image-upload").addEventListener("change", (e) => {
      this.handleImageUpload(e);
    });

    document.getElementById("btn-apply-image").addEventListener("click", () => {
      this.applyUploadedImage();
    });

    // Submit transaction
    document.getElementById("btn-submit").addEventListener("click", () => {
      this.submitTransaction();
    });

    // Image controls
    ["img-scale", "img-rotate", "img-x", "img-y"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        this.updateImagePreview();
      });
    });
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  setTool(tool) {
    document.querySelectorAll(".tools button").forEach((b) => b.classList.remove("active"));
    document.getElementById(`btn-${tool}`).classList.add("active");
    document.getElementById("upload-panel").style.display = tool === "upload" ? "block" : "none";
  }

  updateZoom() {
    const scale = `scale(${this.zoom})`;
    this.canvas.style.transform = scale;
    this.preview.style.transform = scale;
    this.canvas.style.transformOrigin = "top left";
    this.preview.style.transformOrigin = "top left";
    document.getElementById("zoom-level").textContent = `${Math.round(this.zoom * 100)}%`;
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / this.zoom),
      y: Math.floor((e.clientY - rect.top) / this.zoom),
    };
  }

  startDraw(e) {
    this.isDrawing = true;
    this.draw(e);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const { x, y } = this.getCanvasCoords(e);
    const half = Math.floor(this.brushSize / 2);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
          this.setPixel(px, py, this.color);
        }
      }
    }
    this.updatePriceDisplay();
  }

  stopDraw() {
    this.isDrawing = false;
  }

  setPixel(x, y, color) {
    const key = `${x},${y}`;
    this.pendingPixels.set(key, { x, y, ...color });

    this.previewCtx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
    this.previewCtx.fillRect(x, y, 1, 1);
  }

  clearPending() {
    this.pendingPixels.clear();
    this.previewCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.updatePriceDisplay();
  }

  updatePriceDisplay() {
    const count = this.pendingPixels.size;
    const totalDatoshi = count * PIXEL_PRICE;
    const totalGas = (totalDatoshi / GAS_DECIMALS).toFixed(8);

    document.getElementById("pending-pixels").textContent = count;
    document.getElementById("total-price").textContent = totalGas;
    document.getElementById("btn-submit").disabled = count === 0;
  }

  handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.uploadedImage = img;
        this.updateImagePreview();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  updateImagePreview() {
    if (!this.uploadedImage) return;

    const scale = parseInt(document.getElementById("img-scale").value) / 100;
    const rotate = parseInt(document.getElementById("img-rotate").value);
    const imgX = parseInt(document.getElementById("img-x").value);
    const imgY = parseInt(document.getElementById("img-y").value);

    document.getElementById("scale-value").textContent = `${Math.round(scale * 100)}%`;
    document.getElementById("rotate-value").textContent = `${rotate}°`;

    this.previewCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.previewCtx.save();
    this.previewCtx.translate(imgX, imgY);
    this.previewCtx.rotate((rotate * Math.PI) / 180);
    this.previewCtx.drawImage(
      this.uploadedImage,
      0,
      0,
      this.uploadedImage.width * scale,
      this.uploadedImage.height * scale,
    );
    this.previewCtx.restore();

    this.extractPixelsFromPreview(imgX, imgY, scale);
  }

  extractPixelsFromPreview(imgX, imgY, scale) {
    this.pendingPixels.clear();
    const w = Math.min(Math.ceil(this.uploadedImage.width * scale), CANVAS_WIDTH - imgX);
    const h = Math.min(Math.ceil(this.uploadedImage.height * scale), CANVAS_HEIGHT - imgY);

    if (w <= 0 || h <= 0) return;

    const imageData = this.previewCtx.getImageData(imgX, imgY, w, h);
    const data = imageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 128) {
          const px = imgX + x;
          const py = imgY + y;
          if (px < CANVAS_WIDTH && py < CANVAS_HEIGHT) {
            this.pendingPixels.set(`${px},${py}`, {
              x: px,
              y: py,
              r: data[i],
              g: data[i + 1],
              b: data[i + 2],
            });
          }
        }
      }
    }
    this.updatePriceDisplay();
  }

  applyUploadedImage() {
    if (this.pendingPixels.size === 0) return;
    this.submitTransaction();
  }

  async submitTransaction() {
    const pixels = Array.from(this.pendingPixels.values());
    if (pixels.length === 0) return;

    const batchData = this.encodeBatchPixels(pixels);
    const totalCost = pixels.length * PIXEL_PRICE;

    console.log("Submitting transaction:", {
      pixelCount: pixels.length,
      totalCost: totalCost,
      batchDataLength: batchData.length,
    });

    // TODO: Integrate with Neo wallet SDK
    alert(`Transaction ready!\nPixels: ${pixels.length}\nCost: ${(totalCost / GAS_DECIMALS).toFixed(8)} GAS`);

    // Apply to main canvas after successful tx
    pixels.forEach((p) => {
      this.ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      this.ctx.fillRect(p.x, p.y, 1, 1);
    });

    this.clearPending();
  }

  encodeBatchPixels(pixels) {
    const buffer = new Uint8Array(pixels.length * 7);
    pixels.forEach((p, i) => {
      const offset = i * 7;
      buffer[offset] = (p.x >> 8) & 0xff;
      buffer[offset + 1] = p.x & 0xff;
      buffer[offset + 2] = (p.y >> 8) & 0xff;
      buffer[offset + 3] = p.y & 0xff;
      buffer[offset + 4] = p.r;
      buffer[offset + 5] = p.g;
      buffer[offset + 6] = p.b;
    });
    return buffer;
  }

  updateNFTCountdown() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    document.getElementById("next-nft-time").textContent =
      `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  window.pixelCanvas = new PixelCanvas();
});
