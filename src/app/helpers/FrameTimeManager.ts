import Rocket from '../rocket/Rocket';
import RocketView from '../rocket/RocketView';
import WorldGui from '../WorldGui';

export default class FrameTimeManager {
  static readonly MINIMUM_TIME_UNIT_S = 1;

  // Progress towards the next physics step as a fraction (0..1+) rather than
  // seconds: changing the time multiplier (e.g. while paused) then only
  // changes how fast it advances, instead of rescaling the current
  // interpolation point and teleporting the missile.
  stepProgress = 0;

  constructor(
    private rocket: Rocket,
    private rocketView: RocketView,
    private worldGui: WorldGui
  ) {}

  missedUpdateCalls: number = 0;

  update(delta: number): void {
    const updateEachS =
      FrameTimeManager.MINIMUM_TIME_UNIT_S / this.worldGui.timeMultiplier;

    this.stepProgress += delta / updateEachS;

    this.rocketView.setLerpAlpha(this.stepProgress);
    this.rocketView.update();

    if (this.stepProgress >= 1) {
      this.rocketView.updatePrevFromRocket();
      this.rocket.update();

      this.missedUpdateCalls += this.stepProgress - 1;

      while (this.missedUpdateCalls > 1) {
        this.rocket.update();
        this.missedUpdateCalls -= 1;
      }

      this.stepProgress = 0;
    }
  }
}
