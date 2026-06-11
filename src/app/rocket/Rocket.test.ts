import * as THREE from 'three';
import Rocket from './Rocket';
import Earth from '../earth/Earth';

describe('Rocket', () => {
  const earth = new Earth();
  const rocketInitialPosition = Earth.geoCoordinatesToPosition(0, 0);
  const rocketTargetPosition = Earth.geoCoordinatesToPosition(180, 0);

  const toTargetIncline = rocketInitialPosition
    .clone()
    .sub(rocketTargetPosition)
    .normalize();

  it('should match the velocity according to the Tsiolkovsky rocket equation', () => {
    const rocketPayloadMass = 1000;
    const rocketFuelMass = 18400;
    const exhaustVelocity = 3;
    const massFlowRate = 50;

    const rocket = new Rocket(
      earth,
      rocketInitialPosition,
      toTargetIncline,
      1,
      1,
      THREE.MathUtils.degToRad(0.5),
      rocketFuelMass,
      exhaustVelocity,
      massFlowRate,
      rocketPayloadMass
    );

    const simulatedFlightTime = rocketFuelMass / massFlowRate; // seconds

    for (let tick = 0; tick < simulatedFlightTime; tick++) {
      rocket.update();
    }

    // Tsiolkovsky: Δv = ve * ln(m0 / mf)
    const m0 = rocketFuelMass + rocketPayloadMass;
    const mf = rocketPayloadMass;
    const gravityAtSurface =
      (Earth.G * Earth.MASS * 0.001) / (Earth.RADIUS * 1000) ** 2;
    const expectedDeltaV =
      exhaustVelocity * Math.log(m0 / mf) -
      gravityAtSurface * simulatedFlightTime;
    const actualSpeed = rocket.velocity.length();

    expect(actualSpeed).toBeCloseTo(expectedDeltaV, 0);
  });
});
