import * as THREE from 'three';
import Earth from '../earth/Earth';
import LauncherGui from './LauncherGui';
import Launcher from './Launcher';

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

  constructor(
    private launcher: Launcher,
    private launcherGui: LauncherGui,
    private earth: Earth,
    private scene: THREE.Scene
  ) {}

  handleEarthClick = (coordinates: THREE.Vector3) => {
    if (this.launcherGui.startPositionSetIsActive) {
      this.setStartPosition(coordinates);
  
      this.launcherGui.setStartPosition(Earth.positionToGeoCoordinates(coordinates));
      this.launcher.setStartPosition(coordinates);
      

    } else if (this.launcherGui.targetPositionSetIsActive) {
      this.setTargetPosition(coordinates);

      this.launcherGui.setTargetPosition(Earth.positionToGeoCoordinates(coordinates));
      this.launcher.setTargetPosition(coordinates);
    }

    if (this.startMarker && this.targetMarker) {
      this.launcherGui.setCalcTrajectoryButtonDisabled(false);
    }
  };

  setStartPosition(position: THREE.Vector3) {
    this.removeStartPositionIfExist();

    this.startMarker = createMarker(position, this.earth, 0x0000ff);
    this.scene.add(this.startMarker);
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
}
