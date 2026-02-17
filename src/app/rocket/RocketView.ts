import EarthView from 'app/earth/EarthView';
import Rocket from './Rocket';
import * as THREE from 'three';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import nukeAudio from 'public/audio/nuke.mp3';

export class ExplosionEffect {
  private rings: THREE.Mesh[] = [];
  private startTime: number = 0;
  private duration: number = 2000; // 2 seconds
  private isActive: boolean = false;
  private audio: HTMLAudioElement;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ringCount: number = 3
  ) {
    this.audio = new Audio(nukeAudio);
    this.audio.volume = 0.5;
  }

  start(position: THREE.Vector3, normal: THREE.Vector3) {
    this.startTime = Date.now();
    this.isActive = true;

    // Play explosion sound
    this.audio.currentTime = 0;
    this.audio.play().catch((error) => {
      console.warn('Failed to play explosion sound:', error);
    });

    // Create expanding rings
    for (let i = 0; i < this.ringCount; i++) {
      const ringGeometry = new THREE.RingGeometry(1, 2, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);

      // Position ring at explosion point
      ring.position.copy(position);

      // Align ring perpendicular to the surface normal
      ring.lookAt(position.clone().add(normal));

      this.rings.push(ring);
      this.scene.add(ring);
    }
  }

  update() {
    if (!this.isActive) return;

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    if (progress >= 1) {
      this.remove();
      return;
    }

    this.rings.forEach((ring, index) => {
      // Stagger the start of each ring
      const ringDelay = (index / this.ringCount) * 0.3;
      const ringProgress = Math.max(
        0,
        (progress - ringDelay) / (1 - ringDelay)
      );

      // Expand the ring
      const maxScale = 100 + index * 10;
      const scale = 1 + ringProgress * maxScale;
      ring.scale.set(scale, scale, 1);

      // Fade out with damping
      const opacity = (1 - ringProgress) * 0.8 * Math.exp(-ringProgress * 2);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;

      // Change color from orange to red to dark
      const r = 1;
      const g = Math.max(0, 0.5 - ringProgress * 0.5);
      const b = 0;
      (ring.material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
    });
  }

  remove() {
    this.isActive = false;
    this.rings.forEach((ring) => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.MeshBasicMaterial).dispose();
    });
    this.rings = [];
  }

  get active(): boolean {
    return this.isActive;
  }
}

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

// class VectorHistory {
//   prev = new THREE.Vector3();
//   next = new THREE.Vector3();
// }

export default class RocketView {
  group: THREE.Group;
  private arrows: THREE.ArrowHelper[] = [];
  // private arrowsLabels: THREE.Mesh[] = []; //TODO: add on small screen only
  private trailView: TrailView | null = null;
  private burningFireMesh: THREE.Mesh | null = null;
  private thrustDirectionFireMesh: THREE.Mesh | null = null;
  private explosionEffect: ExplosionEffect | null = null;
  private hasTriggeredExplosion: boolean = false;

  prevPosition = new THREE.Vector3();
  prevVelocity = new THREE.Vector3();
  prevThrust = new THREE.Vector3();

  size = 1;
  private arrowLength = 2 * this.size;
  private burningFireSize = 1 * this.size;

  private lerpAlpha = 1;

  setLerpAlpha(alpha: number) {
    this.lerpAlpha = alpha;
  }

  constructor(
    readonly rocket: Rocket,
    private readonly scene: THREE.Scene,
    readonly earthView: EarthView
  ) {
    this.group = new THREE.Group();
    this.trailView = new TrailView(this.scene);
    this.explosionEffect = new ExplosionEffect(this.scene, 5);
  }

  setSize(size: number) {
    this.size = size;
    this.arrowLength = 2 * this.size;
    this.burningFireSize = 1 * this.size;
  }

  init() {
    this.buildRocketMesh();
    this.initArrows();
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

    // Main burning fire (follows rocket/velocity direction)
    const burningFireMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.6,
    });
    const burningFireGeometry = new THREE.CylinderGeometry(
      0.06 * this.burningFireSize,
      0.14 * this.burningFireSize,
      this.burningFireSize,
      16
    );
    const burningFireMesh = new THREE.Mesh(
      burningFireGeometry,
      burningFireMaterial
    );

    burningFireMesh.position.y = -0.5 * this.size;

    this.burningFireMesh = burningFireMesh;
    this.group.add(this.burningFireMesh);

    // Thrust direction fire (small, follows actual thrust direction)
    const thrustFireMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4500, // Orange-red to distinguish from main fire
      transparent: true,
      opacity: 0.7,
    });
    const thrustFireSize = 0.4 * this.size; // Smaller fixed size
    const thrustFireGeometry = new THREE.CylinderGeometry(
      0.04 * thrustFireSize,
      0.1 * thrustFireSize,
      thrustFireSize,
      16
    );
    const thrustDirectionFireMesh = new THREE.Mesh(
      thrustFireGeometry,
      thrustFireMaterial
    );

    thrustDirectionFireMesh.position.y = -0.5 * this.size;

    this.thrustDirectionFireMesh = thrustDirectionFireMesh;
    this.group.add(this.thrustDirectionFireMesh);

    // ------------------------------------------------------------------------
    this.group.name = RocketView.name;
    this.scene.add(this.group);
  }

  private initArrows() {
    this.addArrow(
      'velocity',
      0xff0000,
      this.group.position,
      this.rocket.velocity
    );
    this.addArrow('thrust', 0x00ff00, this.group.position, this.rocket.thrust);
    this.addArrow(
      'gravity',
      0x0000ff,
      this.group.position,
      this.rocket.gravityForce
    );

    this.addArrow(
      'targetIncline',
      0xcc00cc,
      this.group.position,
      this.rocket.calcThrustDirectionToIncline()
    );
  }

  private updateArrows() {
    const velocity = this.getVelocity();
    const thrust = this.getThrust();

    this.updateArrow(
      'gravity',
      this.group.position,
      this.rocket.gravityForce.clone().normalize(),
      this.rocket.gravityForce.length()
    );

    this.updateArrow(
      'velocity',
      this.group.position,
      velocity.clone().normalize(),
      velocity.length()
    );

    this.updateArrow(
      'thrust',
      this.group.position,
      thrust.clone().normalize(),
      thrust.length()
    );

    this.updateArrow(
      'targetIncline',
      this.group.position,
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

  private extendTrail() {
    if (!this.trailView) return;

    const thrustPercentage =
      this.rocket.thrust.length() / this.rocket.maxThrust;

    this.trailView.extendFromVectors(
      this.prevPosition.clone(),
      new THREE.Color(1, thrustPercentage, 1 - thrustPercentage)
    );
  }

  private alignRotation() {
    if (this.rocket.hasLanded) {
      return;
    }

    if (this.rocket.velocity.length() === 0) {
      this.rotateTowards(this.group, this.group.position);
    } else {
      this.rotateTowards(this.group, this.getVelocity().normalize());
    }
  }

  private rotateTowards(
    object: THREE.Object3D | THREE.Mesh,
    normal: THREE.Vector3
  ) {
    // const normal = this.mesh.position.clone().sub(to).normalize();
    object.lookAt(object.position.clone().add(normal));

    object.rotateOnAxis(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(90)
    );
  }

  endPositionSkyMarker: null | THREE.Line = null;

  update(): void {
    this.updatePosition();
    this.updateBurningFireScale();

    this.updateArrows();

    this.alignRotation();

    if (!this.rocket.hasLanded) {
      this.extendTrail();
    }

    if (this.rocket.hasLanded && this.endPositionSkyMarker == null) {
      this.endPositionSkyMarker = this.earthView.createLineToSkyMarker(
        this.rocket.position,
        0x00ff00,
        this.rocket.maxAltitude
      );

      this.scene.add(this.endPositionSkyMarker);
    }

    // Trigger explosion effect when rocket lands
    if (
      this.rocket.hasLanded &&
      !this.hasTriggeredExplosion &&
      this.explosionEffect
    ) {
      const normal = this.rocket.position.clone().normalize();
      this.explosionEffect.start(this.rocket.position.clone(), normal);
      this.hasTriggeredExplosion = true;
    }

    // Update explosion effect animation
    if (this.explosionEffect) {
      this.explosionEffect.update();
    }
  }

  private updateBurningFireScale() {
    let thrustPercentage =
      this.rocket.thrust.length() / (this.rocket.maxThrust * 0.3);

    thrustPercentage = Math.min(thrustPercentage, 2);

    const thrustableSize = this.burningFireSize * thrustPercentage;

    // Update main burning fire (aligned with rocket body)
    this.burningFireMesh!.scale.set(
      thrustPercentage,
      thrustPercentage,
      thrustPercentage
    );
    this.burningFireMesh!.position.y = -thrustableSize / 2;

    // Update thrust direction fire (small, rotates with thrust)
    this.updateThrustDirectionFire();
  }

  private updateThrustDirectionFire() {
    if (!this.thrustDirectionFireMesh || this.rocket.thrust.length() === 0) {
      // Hide or reset when no thrust
      if (this.thrustDirectionFireMesh) {
        this.thrustDirectionFireMesh.visible = false;
      }
      return;
    }

    this.thrustDirectionFireMesh.visible = true;

    const velocity = this.getVelocity();
    const thrust = this.getThrust();

    // Fixed small size for thrust direction indicator
    const thrustFireSize = 0.4 * this.size;

    // If there's velocity, calculate the angle between velocity and thrust
    if (velocity.length() > 0) {
      const velocityDir = velocity.clone().normalize();
      const thrustDir = thrust.clone().normalize();

      // Calculate rotation axis (perpendicular to both vectors)
      const rotationAxis = new THREE.Vector3()
        .crossVectors(velocityDir, thrustDir)
        .normalize();

      // Calculate angle between velocity and thrust
      const angle = velocityDir.angleTo(thrustDir);

      // Only apply rotation if there's a significant angle and valid rotation axis
      if (angle > 0.001 && rotationAxis.length() > 0.001) {
        // Transform rotation axis to local space of the group
        const localRotationAxis = rotationAxis
          .clone()
          .applyQuaternion(this.group.quaternion.clone().invert());

        this.thrustDirectionFireMesh.quaternion.setFromAxisAngle(
          localRotationAxis,
          angle
        );
      } else {
        this.thrustDirectionFireMesh.quaternion.identity();
      }
    } else {
      // No velocity yet, keep aligned with rocket
      this.thrustDirectionFireMesh.quaternion.identity();
    }

    // Update position after rotation so it stays aligned
    const localOffset = new THREE.Vector3(0, -thrustFireSize / 2, 0);
    localOffset.applyQuaternion(this.thrustDirectionFireMesh.quaternion);
    this.thrustDirectionFireMesh.position.copy(localOffset);
  }

  private updatePosition() {
    const position = new THREE.Vector3().lerpVectors(
      this.prevPosition,
      this.rocket.position,
      this.lerpAlpha
    );

    this.group.position.copy(position);
  }

  private getVelocity() {
    return new THREE.Vector3().lerpVectors(
      this.prevVelocity,
      this.rocket.velocity,
      this.lerpAlpha
    );
  }

  private getThrust() {
    return new THREE.Vector3().lerpVectors(
      this.prevThrust,
      this.rocket.thrust,
      this.lerpAlpha
    );
  }

  updatePrevFromRocket() {
    this.prevPosition.copy(this.rocket.position.clone());
    this.prevVelocity.copy(this.rocket.velocity.clone());
    this.prevThrust.copy(this.rocket.thrust.clone());
  }

  applyScaleToArrows(scale: number) {
    this.arrowLength = scale;
  }

  remove() {
    this.scene.remove(this.group);

    if (this.endPositionSkyMarker) {
      this.scene.remove(this.endPositionSkyMarker);
      this.endPositionSkyMarker.geometry.dispose();
      this.endPositionSkyMarker = null;
    }

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

    if (this.explosionEffect) {
      this.explosionEffect.remove();
      this.explosionEffect = null;
    }
  }
}
