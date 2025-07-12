import Rocket from '../rocket/Rocket';
import RocketView from '../rocket/RocketView';
import * as THREE from 'three';
import WorldGui from '../WorldGui';

export default class FrameTimeManager {
  static readonly MINIMUM_TIME_UNIT_MS = 1000;

  lastUpdateTimestamp: number = 0;
  currentPosition: THREE.Vector3 = new THREE.Vector3();
  nextPosition: THREE.Vector3 = new THREE.Vector3();

  constructor(
    private rocket: Rocket,
    private rocketView: RocketView,
    private worldGui: WorldGui
  ) {}

  update() {
    const currentTimestamp = performance.now();
    const deltaTime = currentTimestamp - this.lastUpdateTimestamp;

    const updateEachMs =
      FrameTimeManager.MINIMUM_TIME_UNIT_MS / this.worldGui.timeMultiplier;

    this.rocketView.updateFromCoordinates(
      this.currentPosition
        .clone()
        .lerp(this.nextPosition, deltaTime / updateEachMs)
    );

    if (deltaTime >= updateEachMs) {
      this.currentPosition.copy(this.rocket.position);
      this.rocket.update();
      this.nextPosition.copy(this.rocket.position);

      this.lastUpdateTimestamp = currentTimestamp;
    }
  }
}
