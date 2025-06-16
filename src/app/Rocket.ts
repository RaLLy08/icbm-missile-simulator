import * as THREE from 'three';
import Earth from './Earth';

class Rocket {
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshStandardMaterial;
  mesh: THREE.Mesh;

  scale = new THREE.Vector3(1, 1, 1);

  /**
   * Unit: km
   */
  get position(): THREE.Vector3 {
    return this.mesh.position;
  }
  /**
   * Unit: km/s
   */
  velocity = new THREE.Vector3(0, 0, 0);

  arrows: THREE.ArrowHelper[] = [];

  /**
   * Unit: km/s^2
   */
  acceleration = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: kg
   */
  mass = 1;
  /**
   * Unit: rad
   */
  get rotation(): THREE.Euler {
    return this.mesh.rotation;
  }

  launchTime = 0;

  private addArrow(name: string, direction: THREE.Vector3, color = 0x00ff00) {
    const scale = 100;
    const length = direction.length() * scale;
    const arrow = new THREE.ArrowHelper(
      direction,
      this.mesh.position,
      length,
      color
    );
    arrow.name = name;
    arrow.frustumCulled = false;
    arrow.setLength(length, length * 0.1, length * 0.1);
    arrow.setDirection(direction);
    arrow.setColor(color);
    this.scene.add(arrow);
    this.arrows.push(arrow);
  }


  private updateArrow(name: string, direction: THREE.Vector3, magnitude: number = 1) {
    const arrow = this.arrows.find((a) => a.name === name);

    if (!arrow) return;
    const scale = 100;
    const length = magnitude * scale;

    arrow.setDirection(direction);
    arrow.setLength(length, length * 0.1, length * 0.1);
    arrow.position.copy(this.mesh.position);
  }



  update(tick: number) {
    const distanceToSurface = this.earth.distanceToSurface(this.mesh.position);
    const gravityForce = this.earth.gravityForce(this.mesh.position);

    const maxAcceleration = 30 / 1000; // km/s²
    const burnTimeS = 535; // Time in seconds for the burn

    let xAcceleration = 0;

    if (burnTimeS > this.launchTime) {
      xAcceleration =
        maxAcceleration * Math.sin((this.launchTime * Math.PI) / burnTimeS);
    } else {
      xAcceleration = 0;
    }

    const thrustVector = new THREE.Vector3(
      -xAcceleration,
      0,
      0
    )

    this.acceleration.set(thrustVector.x, thrustVector.y, thrustVector.z);
    
    this.updateArrow(
      'thrust',
      thrustVector.clone().normalize(),
      thrustVector.length() * 10
    );

    let thrustAngleIncline = 0;

    if (distanceToSurface < 1) {
      thrustAngleIncline = THREE.MathUtils.degToRad(0);
    } else if (distanceToSurface < 10) {
      thrustAngleIncline = THREE.MathUtils.degToRad(5);
    } else if (distanceToSurface < 30) {
      thrustAngleIncline = THREE.MathUtils.degToRad(20);
    } else if (distanceToSurface < 80) {
      thrustAngleIncline = THREE.MathUtils.degToRad(45);
    } else if (distanceToSurface < 150) {
      thrustAngleIncline = THREE.MathUtils.degToRad(70);
    } else {
      thrustAngleIncline = THREE.MathUtils.degToRad(85);
    }

    this.acceleration.applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      thrustAngleIncline
    );

    this.launchTime += tick;

    if (distanceToSurface < 0) {
      this.reset();
    } else {
      this.velocity.add(gravityForce.clone().multiplyScalar(tick));

      this.velocity.add(this.acceleration.clone().multiplyScalar(tick));
      this.position.add(this.velocity.clone().multiplyScalar(tick));
    }

    this.updateArrow(
      'gravity',
      gravityForce.clone().normalize(),
      gravityForce.length() * 10
    );

    this.updateArrow(
      'velocity',
      this.velocity.clone().normalize(),
      this.velocity.length()
    );


    // this.lookAtVelocity();
  }

  private lookAtVelocity(): void {
    if (this.acceleration.lengthSq() === 0) return;

    // const direction = this.acceleration.clone().normalize();
    // const lookTarget = this.mesh.position.clone().add(direction);
    // this.mesh.lookAt(lookTarget);

    // this.mesh.quaternion.setFromUnitVectors(
    //   new THREE.Vector3(0, 1, 0), // current axis (Y-axis)
    //   this.velocity.clone().sub(this.mesh.position).normalize() // desired direction
    // );

    // this.mesh.rotateY(Math.PI);
    // this.mesh.rotateX(-Math.PI / 2);
  }

  // private lookAtSky(target: THREE.Mesh): void {
  //   if (this.rocket) {
  //     const gravityForce = this.gravityForce(target.position);

  //     this.rocket.mesh.quaternion.setFromUnitVectors(
  //       new THREE.Vector3(0, 1, 0), // current axis (Y-axis)
  //       gravityForce.clone().sub(this.rocket.position).normalize() // desired direction
  //     );
  //   }
  // }

  constructor(
    private earth: Earth,
    private scene: THREE.Scene,
    // private pane: Pane,
    public initialPosition: THREE.Vector3,
    scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
    private name: string = 'Rocket'
  ) {
    const heigth = 2;
    this.geometry = new THREE.CylinderGeometry(
      1 * scale.x,
      1 * scale.x,
      heigth * scale.y,
      32
    );
    // this.geometry.scale(this.scale.x, this.scale.y, this.scale.z);
    this.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(initialPosition);
    // this.mesh.frustumCulled = false;
    this.mesh.name = name;

    this.addArrow('velocity', new THREE.Vector3(0, 0, 0), 0xff0000);
    this.addArrow('gravity', new THREE.Vector3(0, 0, 0), 0x0000ff);
    this.addArrow('thrust', new THREE.Vector3(0, 0, 0), 0x00ff00);

    this.scene.add(this.mesh);
  }

  reset() {
    this.mesh.position.copy(this.initialPosition);
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
  }
}

export default Rocket;
