import Rocket from '../rocket/Rocket';
import RocketView from '../rocket/RocketView';
import WorldGui from '../WorldGui';

export default class FrameTimeManager {
  static readonly MINIMUM_TIME_UNIT_MS = 1000;

  lastUpdateTimestamp: number = 0;

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

    this.rocketView.setLerpAlpha(deltaTime / updateEachMs);
    this.rocketView.update();

    if (deltaTime >= updateEachMs) {
      this.rocketView.extendTrail();
      this.rocketView.updatePrevFromRocket();
      this.rocket.update();

      this.lastUpdateTimestamp = currentTimestamp;
    }
  }
}
