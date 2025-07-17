import Rocket from './Rocket';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class TrailView {
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

export default class RocketView {
  group: THREE.Group;
  private arrows: THREE.ArrowHelper[] = [];
  // private arrowsLabels: THREE.Mesh[] = []; //TODO: add on small screen only
  private trailView: TrailView | null = null;

  readonly size = 1;
  private arrowLength = 2 * this.size; 

  constructor(
    readonly rocket: Rocket,
    private readonly scene: THREE.Scene
  ) {
    this.group = new THREE.Group();
    this.buildRocketMesh();
    this.initArrows();
    this.trailView = new TrailView(this.scene);

    this.update();
  }

  private buildRocketMesh() {
    const coneColor = 0xff0000;
    const bodyColor = 0xcccccc;
    const legColor = 0x888888;

    // ------------------------------------------------------------------------
    // === Rocket Body ===
    const bodyRadius = 0.1 * this.size;
    const bodyHeight = this.size;

    const bodyGeometry = new THREE.CylinderGeometry(
      bodyRadius,
      bodyRadius,
      bodyHeight,
      16
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = bodyHeight / 2; // bottom touches y = 0
    this.group.add(bodyMesh);

    // ------------------------------------------------------------------------
    // === Rocket Nose Cone ===
    const coneHeight = 0.3 * bodyHeight;
    const coneRadius = bodyRadius; // same radius as the body
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
    const coneMaterial = new THREE.MeshStandardMaterial({ color: coneColor });
    const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
    coneMesh.position.y = bodyHeight + coneHeight / 2; // sits on top of the body
    this.group.add(coneMesh);

    // ------------------------------------------------------------------------
    // === Landing Legs (4) ===
    const legWidth = bodyRadius * 0.4; // thickness left-right
    const legDepth = bodyRadius * 0.1; // thickness front-back
    const legHeight = bodyHeight * 0.3; // how tall the leg is

    // Same geometry for all four legs
    const legGeometry = new THREE.BoxGeometry(
      legWidth,
      legHeight,
      legDepth,
      1,
      1,
      1
    );
    const legMaterial = new THREE.MeshStandardMaterial({ color: legColor });

    // Place each leg 90° apart around the body’s circumference
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2; // 0, 90, 180, 270 degrees
      const x = Math.cos(angle) * (bodyRadius + legWidth / 2);
      const z = Math.sin(angle) * (bodyRadius + legDepth / 2);

      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), angle);

      legMesh.position.set(x, legHeight / 2, z); // bottom just touches y = 0
      this.group.add(legMesh);
    }

    // ------------------------------------------------------------------------
    this.group.name = RocketView.name;
    this.scene.add(this.group);
  }

  private initArrows() {
    this.addArrow(
      'velocity',
      0xff0000,
      this.rocket.position,
      this.rocket.velocity
    );
    this.addArrow('thrust', 0x00ff00, this.rocket.position, this.rocket.thrust);
    this.addArrow(
      'gravity',
      0x0000ff,
      this.rocket.position,
      this.rocket.gravityForce
    );

    this.addArrow(
      'targetIncline',
      0xcc00cc,
      this.rocket.position,
      this.rocket.calcThrustDirectionToIncline()
    );
  }

  private updateArrows() {
    this.updateArrow(
      'gravity',
      this.rocket.position,
      this.rocket.gravityForce.clone().normalize(),
      this.rocket.gravityForce.length()
    );

    this.updateArrow(
      'velocity',
      this.rocket.position,
      this.rocket.velocity.clone().normalize(),
      this.rocket.velocity.length()
    );

    this.updateArrow(
      'thrust',
      this.rocket.position,
      this.rocket.thrust.clone().normalize(),
      this.rocket.thrust.length()
    );

    this.updateArrow(
      'targetIncline',
      this.rocket.position,
      this.rocket.calcThrustDirectionToIncline().clone().normalize(),
      this.rocket.calcThrustDirectionToIncline().length()
    );
  }

  private updateArrow(
    name: string,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    magnitude: number = 1
  ) {
    const arrow = this.arrows.find((a) => a.name === `${name}-arrow`);

    if (!arrow) return;
    let length = this.arrowLength;

    if (magnitude === 0) {
      length = 0;
    }

    arrow.setDirection(direction);
    arrow.setLength(
      length,
      Math.min(length * 0.05, 10),
      Math.min(length * 0.03, 5)
    );
    arrow.position.copy(position);

    // const label = this.arrowsLabels.find((l) => l.name === `${name}-label`);
    // if (label) {
    //   const midpoint = new THREE.Vector3().addVectors(
    //     position,
    //     direction.clone().multiplyScalar(length)
    //   );
    //   label.position.copy(midpoint);
    //   label.position.y += 0.2; // slightly above the arrow
    //   label.lookAt(this.camera.position); // make it face the arrow
    // }
  }

  private addArrow(
    name: string,
    color = 0x00ff00,
    position = new THREE.Vector3(0, 0, 0),
    direction = new THREE.Vector3(0, 0, 0)
  ) {
    const length = direction.length() * this.arrowLength;
    const arrow = new THREE.ArrowHelper(direction, position, length, color);
    arrow.name = `${name}-arrow`;
    arrow.frustumCulled = false;
    arrow.setLength(length, length * 0.1, length * 0.1);
    arrow.setDirection(direction);
    arrow.setColor(color);
    this.scene.add(arrow);
    this.arrows.push(arrow);

    // const loader = new FontLoader();
    // loader.load(
    //   'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    //   (font) => {
    //     const textGeometry = new TextGeometry('Middle', {
    //       font: font,
    //       size: 10,
    //     });
    //     const textMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    //     const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    //     const midpoint = new THREE.Vector3().addVectors(
    //       position,
    //       direction.clone().multiplyScalar(length / 2)
    //     );

    //     textMesh.position.copy(midpoint);
    //     textMesh.position.y += 0.2; // slightly above the arrow
    //     textMesh.lookAt(this.camera.position); // make it face the camera
    //     textMesh.name = `${name}-label`;
    //     this.arrowsLabels.push(textMesh);

    //     this.scene.add(textMesh);
    //   }
    // );
  }

  updateTrail() {
    if (!this.trailView) return;

    const thrustPercentage =
      this.rocket.thrust.length() / this.rocket.maxThrust;

    this.trailView.extendFromVectors(
      this.rocket.position.clone(),
      new THREE.Color(1, thrustPercentage, 1 - thrustPercentage)
    );
  }

  private alignRotation() {
    if (this.rocket.hasLanded) {
      return;
    }

    if (this.rocket.velocity.length() === 0) {
      this.rotateTowards(this.rocket.position);
    } else {
      this.rotateTowards(this.rocket.velocity.clone().normalize());
    }
  }

  private rotateTowards(normal: THREE.Vector3) {
    // const normal = this.mesh.position.clone().sub(to).normalize();
    this.group.lookAt(this.group.position.clone().add(normal));

    this.group.rotateOnAxis(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(90)
    );
  }

  update(): void {
    this.updateFromCoordinates(this.rocket.position);
  }

  updateFromCoordinates(position: THREE.Vector3): void {
    this.group.position.copy(position);
    this.updateArrows();

    if (!this.rocket.hasLanded) {
      this.updateTrail();
    }

    this.alignRotation();
  }

  applyScaleToArrows(scale: number) {
    this.arrowLength = scale;
  }

  remove() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    this.group.clear();

    this.arrows.forEach((arrow) => {
      arrow.dispose();
      this.scene.remove(arrow);
    });
    this.arrows = [];

    if (this.trailView) {
      this.trailView.remove();
      this.trailView = null;
    }
  }
}
