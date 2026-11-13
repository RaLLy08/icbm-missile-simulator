import * as THREE from 'three';
import Rocket from './Rocket';
import MultiStageRocket from './MultiStageRocket';
import Earth from '../earth/Earth';

describe('MultiStageRocket', () => {
  const earth = new Earth();
  const rocketInitialPosition = Earth.geoCoordinatesToPosition(0, 0);
  const rocketTargetPosition = Earth.geoCoordinatesToPosition(180, 0);

  const toTargetIncline = rocketInitialPosition
    .clone()
    .sub(rocketTargetPosition)
    .normalize();

  const gravityAtSurface =
    (Earth.G * Earth.MASS * 0.001) / (Earth.RADIUS * 1000) ** 2;

  const createRocket = (payloadMass: number) =>
    new Rocket(
      earth,
      rocketInitialPosition,
      toTargetIncline,
      1,
      1,
      THREE.MathUtils.degToRad(0.5),
      undefined,
      undefined,
      undefined,
      payloadMass
    );

  it('switches engine after the fuel of the current stage ends', () => {
    const payloadMass = 1000;
    const multiStage = new MultiStageRocket(createRocket(payloadMass), [
      { fuelMass: 10000, exhaustVelocity: 3, massFlowRate: 100 }, // 100 s
      { fuelMass: 3000, exhaustVelocity: 3.5, massFlowRate: 50 }, // 60 s
    ]);
    const { rocket } = multiStage;

    expect(rocket.fuelMass).toBe(13000);
    expect(rocket.fuelCombustionTime).toBe(160);
    expect(rocket.massFlowRate).toBe(100);

    for (let tick = 0; tick < 100; tick++) multiStage.update();

    expect(multiStage.currentStageIndex).toBe(1);
    expect(rocket.exhaustVelocity).toBe(3.5);
    expect(rocket.massFlowRate).toBe(50);
    expect(rocket.remainingFuel).toBeCloseTo(3000, 6);

    for (let tick = 100; tick < 160; tick++) multiStage.update();

    expect(multiStage.currentStage).toBeNull();
    expect(rocket.isEngineCutoff).toBe(true);

    // Tsiolkovsky per stage, minus gravity losses
    const expectedDeltaV =
      3 * Math.log((payloadMass + 13000) / (payloadMass + 3000)) +
      3.5 * Math.log((payloadMass + 3000) / payloadMass) -
      gravityAtSurface * 160;

    expect(rocket.velocity.length()).toBeCloseTo(expectedDeltaV, 0);
  });

  it('splits a step at the stage boundary', () => {
    const multiStage = new MultiStageRocket(createRocket(1000), [
      { fuelMass: 150, exhaustVelocity: 3, massFlowRate: 100 }, // 1.5 s
      { fuelMass: 1000, exhaustVelocity: 3, massFlowRate: 50 },
    ]);

    multiStage.update(1);
    multiStage.update(1);

    // 150 kg of stage 1 + 0.5 s * 50 kg/s of stage 2
    expect(multiStage.rocket.burntFuel).toBeCloseTo(175, 6);
    expect(multiStage.currentStageIndex).toBe(1);
  });
});
