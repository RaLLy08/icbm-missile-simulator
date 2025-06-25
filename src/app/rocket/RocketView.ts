import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import Rocket from './Rocket';
import * as THREE from 'three';

export default class RocketView {
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh;

  private arrows: THREE.ArrowHelper[] = [];

  private trailLine: THREE.Line | null = null;
  private trailGeometry = new THREE.BufferGeometry();
  private readonly trailMaxPoints = 1000;
  private trailPositions: Float32Array = new Float32Array(
    this.trailMaxPoints * 3
  ); // x, y, z for each point

  constructor(
    private readonly rocket: Rocket,
    private readonly scene: THREE.Scene
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
    this.initTrail();
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
  }

  private updateArrows() {
    this.updateArrow(
      'gravity',
      this.rocket.position,
      this.rocket.gravityForce.clone().normalize(),
      this.rocket.gravityForce.length() * 10
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
      this.rocket.thrust.length() * 10
    );
  }

  private updateArrow(
    name: string,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    magnitude: number = 1
  ) {
    const arrow = this.arrows.find((a) => a.name === name);

    if (!arrow) return;
    const scale = 100;
    const length = magnitude * scale;

    arrow.setDirection(direction);
    arrow.setLength(length, length * 0.1, length * 0.1);
    arrow.position.copy(position);
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
    arrow.name = name;
    arrow.frustumCulled = false;
    arrow.setLength(length, length * 0.1, length * 0.1);
    arrow.setDirection(direction);
    arrow.setColor(color);
    this.scene.add(arrow);
    this.arrows.push(arrow);
  }

  private initTrail() {
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.trailPositions, 3)
    );

    const material = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    this.trailLine = new THREE.Line(this.trailGeometry, material);
    this.scene.add(this.trailLine);

    for (let i = 0; i < this.trailMaxPoints; i++) {
      this.trailPositions[i * 3] = this.rocket.position.x;
      this.trailPositions[i * 3 + 1] = this.rocket.position.y;
      this.trailPositions[i * 3 + 2] = this.rocket.position.z;
    }

    this.trailLine.frustumCulled = false;

    this.scene.add(this.trailLine);

    this.trailLine.name = 'TRAIL';
  }

  private removeTrail() {
    if (this.trailLine) {
      this.scene.remove(this.trailLine);
      this.trailLine.geometry.dispose();
      this.trailLine = null;
    }
  }

  private updateTrail() {
    for (let i = this.trailMaxPoints - 1; i > 0; i--) {
      this.trailPositions[i * 3] = this.trailPositions[(i - 1) * 3];
      this.trailPositions[i * 3 + 1] = this.trailPositions[(i - 1) * 3 + 1];
      this.trailPositions[i * 3 + 2] = this.trailPositions[(i - 1) * 3 + 2];
    }

    this.trailPositions[0] = this.rocket.position.x;
    this.trailPositions[1] = this.rocket.position.y;
    this.trailPositions[2] = this.rocket.position.z;

    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  update(): void {
    this.mesh.position.copy(this.rocket.position);
    this.updateArrows();

    if (!this.rocket.hasLanded) {
      this.updateTrail();
    }
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
