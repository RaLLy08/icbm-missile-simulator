import * as THREE from 'three';

const DEFAULT_COLOR = new THREE.Color(1, 1, 1);

/**
 * Polyline trail backed by a single preallocated GPU buffer.
 *
 * The whole path is always kept. When the buffer is full, every other point
 * is dropped (the newest point is always kept), halving the resolution
 * instead of erasing the start of the trail. That costs an amortized O(1)
 * per point, with no per-point allocations and only the changed range
 * uploaded to the GPU.
 */
export default class TrailView {
  private line: THREE.Line | null = null;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.LineBasicMaterial({
    vertexColors: true,
  });
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly capacity: number;

  /** Number of stored points. */
  private count = 0;

  /**
   * @param initialVectorPositions - Points the trail starts with.
   * @param initialColors - Colors of the initial points (white if missing).
   * @param vectorsLimit - Maximum number of points stored. When reached, the
   *   trail is thinned out rather than shortened.
   */
  constructor(
    private readonly scene: THREE.Scene,
    initialVectorPositions: THREE.Vector3[] = [],
    initialColors: THREE.Color[] = [],
    vectorsLimit: number = 5000
  ) {
    this.capacity = Math.max(4, vectorsLimit);
    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);

    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('color', this.colorAttr);
    this.geometry.setDrawRange(0, 0);

    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
    this.line.name = 'TRAIL-LINE';
    this.scene.add(this.line);

    if (initialVectorPositions.length > 0) {
      this.extendFromVectors(initialVectorPositions, initialColors);
    }
  }

  extendFromVectors(
    vectors: THREE.Vector3[] | THREE.Vector3,
    colors: THREE.Color[] | THREE.Color = []
  ) {
    if (!Array.isArray(vectors)) vectors = [vectors];
    if (!Array.isArray(colors)) colors = [colors];
    if (vectors.length === 0) return;

    let firstChanged = this.count;

    for (let i = 0; i < vectors.length; i++) {
      if (this.count >= this.capacity) {
        this.decimate();
        firstChanged = 0;
      }

      const index = this.count * 3;
      const v = vectors[i];
      const c = colors[i] ?? colors[colors.length - 1] ?? DEFAULT_COLOR;

      this.positions[index] = v.x;
      this.positions[index + 1] = v.y;
      this.positions[index + 2] = v.z;
      this.colors[index] = c.r;
      this.colors[index + 1] = c.g;
      this.colors[index + 2] = c.b;

      this.count++;
    }

    this.markUpdated(firstChanged, this.count - firstChanged);
    this.geometry.setDrawRange(0, this.count);
  }

  getLastVectorPosition(
    target = new THREE.Vector3()
  ): THREE.Vector3 | null {
    if (this.count === 0) return null;

    const index = (this.count - 1) * 3;
    return target.set(
      this.positions[index],
      this.positions[index + 1],
      this.positions[index + 2]
    );
  }

  /**
   * Keeps every other point, counted back from the newest one so the
   * trail stays attached to the missile. The first point is kept too, so
   * the trail still starts at the launch site.
   */
  private decimate() {
    const last = this.count - 1;
    let write = 1; // point 0 (launch site) stays in place

    // Oldest-first, so writes never overtake unread points
    for (let read = last % 2 === 0 ? 2 : 1; read <= last; read += 2) {
      const from = read * 3;
      const to = write * 3;
      this.positions.copyWithin(to, from, from + 3);
      this.colors.copyWithin(to, from, from + 3);
      write++;
    }

    this.count = write;
  }

  private markUpdated(startPoint: number, pointCount: number) {
    if (pointCount <= 0) return;

    // Ranges accumulate until the next render; three.js clears them after upload
    for (const attr of [this.positionAttr, this.colorAttr]) {
      attr.addUpdateRange(startPoint * 3, pointCount * 3);
      attr.needsUpdate = true;
    }
  }

  /** Hidden trails keep recording, so re-showing them leaves no gap. */
  setVisible(visible: boolean) {
    if (this.line) this.line.visible = visible;
  }

  remove() {
    if (!this.line) return;

    this.scene.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
    this.line = null;
  }
}
