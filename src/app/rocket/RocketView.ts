import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import Rocket from './Rocket';
import * as THREE from 'three';
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
      )
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
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh;

  private arrows: THREE.ArrowHelper[] = [];
  // private arrowsLabels: THREE.Mesh[] = []; //TODO: add on small screen only
  private arrowScale = 100;
  private trailView: TrailView | null = null;

  constructor(
    private readonly rocket: Rocket,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera
  ) {
    const heigth = 2;

    this.geometry = new THREE.CylinderGeometry(2, 2, heigth * 2, 32);
    // this.geometry.scale(this.scale.x, this.scale.y, this.scale.z);
    this.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(this.rocket.position);
    // this.mesh.frustumCulled = false;
    this.mesh.name = RocketView.name;

    this.scene.add(this.mesh);

    this.initArrows();
    this.trailView = new TrailView(this.scene);
  }


  private initArrows() {
    this.addArrow(
      'velocity',
      0x00ff00,
      this.rocket.position,
      this.rocket.velocity
    );
    this.addArrow('thrust', 0xff0000, this.rocket.position, this.rocket.thrust);
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
    const length = magnitude * this.arrowScale;

    arrow.setDirection(direction);
    arrow.setLength(
      length,
      Math.min(length * 0.2, 20),
      Math.min(length * 0.1, 10)
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
    const scale = 100;
    const length = direction.length() * scale;
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

    const yellowColor = this.rocket.thrust.length() / this.rocket.maxThrust;
 
    this.trailView.extendFromVectors(
      this.rocket.position.clone(),
      new THREE.Color(1, yellowColor, 1 - yellowColor)
    );
  }

  update(): void {
    this.mesh.position.copy(this.rocket.position);
    this.updateArrows();

    if (!this.rocket.hasLanded) {
      
      this.updateTrail();
    }
  }

  applyScaleToArrows(scale: number) {
    this.arrowScale = scale;
  }

  focusCamera(controls: TrackballControls, camera: THREE.PerspectiveCamera) {
    // Calculate direction from sphere center to object (surface normal)
    const normalDirection = this.rocket.gravityForce.clone().normalize();

    normalDirection.applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(80)
    );

    // normalDirection.applyAxisAngle(
    //   new THREE.Vector3(0, 1, 0),
    //   THREE.MathUtils.degToRad(90)
    // );

    // Position the camera just above the object in the normal direction
    const cameraPosition = new THREE.Vector3()
      .copy(this.rocket.position)
      .addScaledVector(normalDirection, 10);

    camera.position.copy(cameraPosition);

    // Aim the camera to look at the object
    controls.target.copy(this.rocket.position);

    // Update camera projection matrix (in case you move far from center)
    camera.updateProjectionMatrix();

    // Update controls
    controls.update();
  }
}
