import * as THREE from 'three';
import Earth from '../earth/Earth';

const createMarker = (
  position: THREE.Vector3,
  earth: Earth,
  color: number = 0x0000ff
) => {
  const radius = 80; // torus radius
  const tube = 16; // torus thickness

  const normal = position.clone().sub(earth.position).normalize();

  // create torus
  const geometry = new THREE.TorusGeometry(radius, tube, 16, 100);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.copy(position);
  marker.lookAt(position.clone().add(normal)); // orient the torus to face the normal direction

  marker.castShadow = true;
  marker.receiveShadow = true;

  return marker;
};

export default class LauncherView {
  startMarker: THREE.Object3D | null = null;
  targetMarker: THREE.Object3D | null = null;
  activeMarker: THREE.Object3D | null = null;

  constructor(
    private earth: Earth,
    private scene: THREE.Scene
  ) {}

  setStartPosition(position: THREE.Vector3) {
    this.removeStartPositionIfExist();

    this.startMarker = createMarker(position, this.earth, 0x0000ff);
    this.scene.add(this.startMarker);
  }

  setActivePosition(position: THREE.Vector3, type: 'start' | 'target' = 'start') {
    if (this.activeMarker) {
      this.scene.remove(this.activeMarker);
      this.activeMarker = null;
    }

    if (this.startMarker && type === 'start') {
      this.startMarker.visible = false;
    }

    if (this.targetMarker && type === 'target') {
      this.targetMarker.visible = false;
    }

    if (type === 'start') {
      this.activeMarker = createMarker(position, this.earth, 0x0000ff);
    } else if (type === 'target') {
      this.activeMarker = createMarker(position, this.earth, 0xff0000);
    }
    
    this.scene.add(this.activeMarker!);
  }

  activePositionWasSet() {
    if (this.activeMarker) {
      this.activeMarker.visible = false;
    }
    if (this.startMarker) {
      this.startMarker.visible = true;
    }

    if (this.targetMarker) {
      this.targetMarker.visible = true;
    }
  }


  removeStartPositionIfExist() {
    if (this.startMarker) {
      this.scene.remove(this.startMarker);

      this.startMarker = null;
      return;
    }
  }

  setTargetPosition(position: THREE.Vector3) {
    this.removeTargetPositionIfExist();

    this.targetMarker = createMarker(position, this.earth, 0xff0000);
    this.scene.add(this.targetMarker);
  }

  removeTargetPositionIfExist() {
    if (this.targetMarker) {
      this.scene.remove(this.targetMarker);
      this.targetMarker = null;
      return;
    }
  }

  remove() {
    this.removeStartPositionIfExist();
    this.removeTargetPositionIfExist();
  }
}
