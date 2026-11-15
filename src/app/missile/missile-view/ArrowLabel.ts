import * as THREE from 'three';

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 64;
/** Label height as a fraction of the viewport height (constant on screen). */
const SCREEN_HEIGHT = 0.035;
/** Redraw at most this often so numbers stay readable. */
const MIN_REDRAW_INTERVAL_MS = 100;

/**
 * A text sprite showing a vector's value. It keeps a constant on-screen size
 * and is drawn just below its anchor point, over everything else.
 */
export default class ArrowLabel {
  readonly sprite: THREE.Sprite;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly texture: THREE.CanvasTexture | null;
  private readonly color: string;
  private text = '';
  private lastDrawTime = 0;

  constructor(color: number) {
    this.color = `#${new THREE.Color(color).getHexString()}`;

    const canvas =
      typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.ctx = canvas?.getContext('2d') ?? null;

    if (canvas && this.ctx) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      this.texture = new THREE.CanvasTexture(canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
    } else {
      this.texture = null;
    }

    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
    });

    this.sprite = new THREE.Sprite(material);
    this.sprite.scale.set(
      SCREEN_HEIGHT * (CANVAS_WIDTH / CANVAS_HEIGHT),
      SCREEN_HEIGHT,
      1
    );
    // Anchor at the top edge, slightly lower -> text sits under the point
    this.sprite.center.set(0.5, 1.15);
    this.sprite.renderOrder = 999;
    this.sprite.frustumCulled = false;
    this.sprite.visible = this.texture !== null;
  }

  setText(text: string, force = false) {
    if (!this.ctx || !this.texture || text === this.text) return;

    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!force && this.text && now - this.lastDrawTime < MIN_REDRAW_INTERVAL_MS)
      return;

    this.text = text;
    this.lastDrawTime = now;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark outline keeps the text readable over Earth and space
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillStyle = this.color;
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.sprite.removeFromParent();
    this.texture?.dispose();
    this.sprite.material.dispose();
  }
}
