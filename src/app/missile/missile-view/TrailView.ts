import * as THREE from 'three';

export default class TrailView {
  private line: THREE.Line | null = null;
  private geometry = new THREE.BufferGeometry();
  private positions: Float32Array = new Float32Array();
  private colors: Float32Array = new Float32Array();

  /**
   * @param positions - Position (x,y,z) based of which the trail will be drawn.
   * @param positionsCount - Number of positions in the trail. (x,y,z) - is one position.
   */
  constructor(
    private readonly scene: THREE.Scene,
    private readonly initialVectorPositions: THREE.Vector3[] = [],
    private readonly initialColors: THREE.Color[] = [],
    private readonly vectorsLimit: number = 5000
  ) {
    this.init();
  }

  extendFromVectors(
    vectors: THREE.Vector3[] | THREE.Vector3,
    colors: THREE.Color[] | THREE.Color = []
  ) {
    if (!Array.isArray(vectors)) {
      vectors = [vectors];
    }

    if (!Array.isArray(colors)) {
      colors = [colors];
    }

    if (vectors.length === 0) return;

    const newPositions = this.vectorPositionsToFloatArray(vectors);

    this.extendPositions(newPositions);

    if (colors.length > 0) {
      const newColors = this.colorToFloatArray(colors);

      this.extendColors(newColors);
    }
  }

  private extendPositions(newPositions: Float32Array) {
    this.positions = this.getExtendedFloatArray(this.positions, newPositions);

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.geometry.attributes.position.needsUpdate = true;
  }

  getLastVectorPosition(): THREE.Vector3 | null {
    if (this.positions.length === 0) return null;

    const lastIndex = this.positions.length - 3;
    return new THREE.Vector3(
      this.positions[lastIndex],
      this.positions[lastIndex + 1],
      this.positions[lastIndex + 2]
    );
  }

  private extendColors(newColors: Float32Array) {
    this.colors = this.getExtendedFloatArray(this.colors, newColors);

    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );
    this.geometry.attributes.color.needsUpdate = true;
  }

  private vectorPositionsToFloatArray(vectors: THREE.Vector3[]): Float32Array {
    const array = new Float32Array(vectors.length * 3);

    for (let i = 0; i < vectors.length; i++) {
      array[i * 3] = vectors[i].x;
      array[i * 3 + 1] = vectors[i].y;
      array[i * 3 + 2] = vectors[i].z;
    }
    return array;
  }

  private colorToFloatArray(colors: THREE.Color[]): Float32Array {
    const array = new Float32Array(colors.length * 3);
    for (let i = 0; i < colors.length; i++) {
      array[i * 3] = colors[i].r;
      array[i * 3 + 1] = colors[i].g;
      array[i * 3 + 2] = colors[i].b;
    }
    return array;
  }

  private getExtendedFloatArray(origin: Float32Array, add: Float32Array) {
    if (origin.length === 0) return add;
    const totalLength = origin.length + add.length;
    const limit = this.vectorsLimit * 3;

    const newPositions = new Float32Array(Math.min(totalLength, limit));

    if (totalLength > limit) {
      const excess = totalLength - limit;

      newPositions.set(origin.subarray(excess), 0);

      newPositions.set(add, origin.length - excess);
    } else {
      newPositions.set(origin);
      newPositions.set(add, origin.length);
    }

    return newPositions;
  }

  private init() {
    this.geometry = new THREE.BufferGeometry();

    if (this.initialVectorPositions.length > 0) {
      this.positions = this.vectorPositionsToFloatArray(
        this.initialVectorPositions
      );
    }

    if (this.initialColors.length > 0) {
      this.colors = this.colorToFloatArray(this.initialColors);
    }

    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
    });
    this.line = new THREE.Line(this.geometry, material);

    this.line.frustumCulled = false;
    this.line.name = 'TRAIL-LINE';

    this.scene.add(this.line);
  }

  remove() {
    if (!this.line) return;

    this.scene.remove(this.line);
    this.line.geometry.dispose();
    this.line = null;
  }
}
