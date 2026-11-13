import Rocket from './Rocket';

/**
 * One engine stage. Stages burn in order; when a stage runs out of fuel
 * the next one ignites.
 */
export type RocketStage = {
  /** Unit: km/s */
  exhaustVelocity: number;
  /** Unit: kg/s */
  massFlowRate: number;
  /** Unit: kg */
  fuelMass: number;
};

/** Below this a stage boundary inside a step is treated as reached. */
const EPSILON_S = 1e-9;

/**
 * Drives a Rocket through several engine stages. The rocket carries the
 * fuel of all stages; once the fuel of the burning stage is used up, the
 * rocket's exhaust velocity and mass flow rate switch to the next stage.
 *
 * Use `update` instead of `rocket.update`, so stage switches happen.
 */
export default class MultiStageRocket {
  /** Stages that can actually burn (positive fuel and flow rate). */
  readonly stages: RocketStage[];

  /**
   * Index of the burning stage; equals `stages.length` after the last
   * stage burns out.
   */
  currentStageIndex = 0;

  /** Burnt fuel at which each stage is used up. Unit: kg */
  private readonly stageFuelEnds: number[] = [];

  constructor(
    readonly rocket: Rocket,
    stages: RocketStage[]
  ) {
    this.stages = stages
      .filter((s) => s.fuelMass > 0 && s.massFlowRate > 0)
      .map((s) => ({ ...s }));

    if (this.stages.length === 0) {
      throw new Error('MultiStageRocket requires at least one stage.');
    }

    let fuel = 0;
    let burnTime = 0;
    for (const stage of this.stages) {
      fuel += stage.fuelMass;
      burnTime += stage.fuelMass / stage.massFlowRate;
      this.stageFuelEnds.push(fuel);
    }

    rocket.fuelMass = fuel;
    rocket.fuelCombustionTime = burnTime;
    rocket.currentTotalMass = rocket.payloadMass + rocket.remainingFuel;

    this.syncStage();
  }

  /** The stage burning right now, or null after engine cutoff. */
  get currentStage(): RocketStage | null {
    return this.stages[this.currentStageIndex] ?? null;
  }

  /** Fuel left in the burning stage. Unit: kg */
  get currentStageRemainingFuel() {
    const end = this.stageFuelEnds[this.currentStageIndex];
    return end == null ? 0 : Math.max(end - this.rocket.burntFuel, 0);
  }

  /**
   * Advances the rocket by `tick` seconds. A step that crosses a stage
   * boundary is split there, so each stage burns exactly its own fuel.
   */
  update(tick = 1) {
    let remaining = tick;

    while (remaining > EPSILON_S) {
      this.syncStage();

      const stage = this.currentStage;
      const stageTimeLeft = stage
        ? this.currentStageRemainingFuel / stage.massFlowRate
        : Infinity;
      // Do not split a step on the last stage: the rocket stops by itself
      const isLastStage = this.currentStageIndex >= this.stages.length - 1;
      const step =
        !isLastStage && stageTimeLeft < remaining - EPSILON_S
          ? stageTimeLeft
          : remaining;

      this.rocket.update(step);
      remaining -= step;

      if (this.rocket.hasLanded) break;
    }

    this.syncStage();
  }

  /** Selects the stage matching the burnt fuel and applies its engine. */
  private syncStage() {
    const burntFuel = this.rocket.burntFuel;
    let i = this.currentStageIndex;
    // Small tolerance for floating point error at the stage boundary
    while (
      i < this.stages.length &&
      burntFuel >= this.stageFuelEnds[i] - 1e-6
    ) {
      i++;
    }
    this.currentStageIndex = i;

    const stage = this.currentStage;
    if (stage) {
      this.rocket.exhaustVelocity = stage.exhaustVelocity;
      this.rocket.massFlowRate = stage.massFlowRate;
    }
  }
}
