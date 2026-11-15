import MultiStageMissile from '../missile/MultiStageMissile';
import MissileView from '../missile/MissileView';
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
    // Game-clock delta is already 0 while paused
    this.missileView.update(delta * this.worldGui.timeMultiplier);

    if (this.stepProgress >= 1) {
      this.missileView.updatePrevFromMissile();
      this.missile.update();

      this.missedUpdateCalls += this.stepProgress - 1;

      while (this.missedUpdateCalls > 1) {
        this.missile.update();
        this.missedUpdateCalls -= 1;
      }

      this.stepProgress = 0;
    }
  }
}
