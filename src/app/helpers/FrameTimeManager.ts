import Rocket from '../rocket/Rocket';
import RocketView from '../rocket/RocketView';
import WorldGui from '../WorldGui';

export default class FrameTimeManager {
  static readonly MINIMUM_TIME_UNIT_S = 1;

  passedTimeBeforeUpdate = 0;

  constructor(
    private rocket: Rocket,
    private rocketView: RocketView,
    private worldGui: WorldGui
  ) {}

  missedUpdateCalls: number = 0;

  update(delta: number): void {
    this.passedTimeBeforeUpdate += delta;

    const updateEachMs =
      FrameTimeManager.MINIMUM_TIME_UNIT_S / this.worldGui.timeMultiplier;

    this.rocketView.setLerpAlpha(this.passedTimeBeforeUpdate / updateEachMs);
    this.rocketView.update();

    let shouldCallUpdateTimes = this.passedTimeBeforeUpdate / updateEachMs;

    if (this.passedTimeBeforeUpdate >= updateEachMs) {
      this.rocketView.updatePrevFromRocket();
      this.rocket.update();
      shouldCallUpdateTimes -= 1;

      this.missedUpdateCalls += shouldCallUpdateTimes;

      while (this.missedUpdateCalls > 1) {
        this.rocket.update();
        this.missedUpdateCalls -= 1;
      }

      this.passedTimeBeforeUpdate = 0;
    }
  }
}
