import MultiStageMissile from '../missile/MultiStageMissile';
import MissileView from '../missile/missile-view/MissileView';
import WorldGui from '../WorldGui';

export default class FrameTimeManager {
  static readonly MINIMUM_TIME_UNIT_S = 1;

  // Progress towards the next physics step as a fraction (0..1+) rather than
  // seconds: changing the time multiplier (e.g. while paused) then only
  // changes how fast it advances, instead of rescaling the current
  // interpolation point and teleporting the missile.
  stepProgress = 0;

  constructor(
    private missile: MultiStageMissile,
    private missileView: MissileView,
    private worldGui: WorldGui
  ) {}

  missedUpdateCalls: number = 0;

  update(delta: number): void {
    const updateEachS =
      FrameTimeManager.MINIMUM_TIME_UNIT_S / this.worldGui.timeMultiplier;

    this.stepProgress += delta / updateEachS;

    this.missileView.setLerpAlpha(this.stepProgress);
    this.missileView.setActiveStage(this.missile.currentStageIndex);
    this.missileView.update();

    if (this.stepProgress >= 1) {
      this.missileView.updatePrevFromMissile();
      this.step();

      this.missedUpdateCalls += this.stepProgress - 1;

      while (this.missedUpdateCalls > 1) {
        this.step();
        this.missedUpdateCalls -= 1;
      }

      this.stepProgress = 0;
    }
  }

  /** One physics step of the missile and its separated debris. */
  private step() {
    this.missile.update(FrameTimeManager.MINIMUM_TIME_UNIT_S);
    this.missileView.stepDebris(FrameTimeManager.MINIMUM_TIME_UNIT_S);
  }
}
