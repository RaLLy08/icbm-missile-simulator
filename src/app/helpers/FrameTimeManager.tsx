import Rocket from '../rocket/Rocket';
import RocketView from '../rocket/RocketView';
import WorldGui from '../WorldGui';

export default class FrameTimeManager {
  static readonly MINIMUM_TIME_UNIT_MS = 1000;

  lastUpdateTimestamp: number | null = null;

  constructor(
    private rocket: Rocket,
    private rocketView: RocketView,
    private worldGui: WorldGui
  ) {}

  missedUpdateCalls: number = 0;

  update() {
    const currentTimestamp = performance.now();
    let deltaTime = 0;

    if (this.lastUpdateTimestamp === null) {
      this.lastUpdateTimestamp = currentTimestamp;
    } else {
      deltaTime = currentTimestamp - this.lastUpdateTimestamp;
    }

    const updateEachMs =
      FrameTimeManager.MINIMUM_TIME_UNIT_MS / this.worldGui.timeMultiplier;

    this.rocketView.setLerpAlpha(deltaTime / updateEachMs);
    this.rocketView.update();

    let shouldCallUpdateTimes = deltaTime / updateEachMs;

    if (deltaTime >= updateEachMs) {
      this.rocketView.updatePrevFromRocket();
      this.rocket.update();
      shouldCallUpdateTimes -= 1;

      this.missedUpdateCalls += shouldCallUpdateTimes;

      while (this.missedUpdateCalls > 1) {
        this.rocket.update();
        this.missedUpdateCalls -= 1;
      }

      this.lastUpdateTimestamp = currentTimestamp;
    }
  }
}
