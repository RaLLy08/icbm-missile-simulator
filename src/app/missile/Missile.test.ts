import * as THREE from 'three';
import Missile from './Missile';
import Earth from '../earth/Earth';

describe('Missile', () => {
  const earth = new Earth();
  const missileInitialPosition = Earth.geoCoordinatesToPosition(0, 0);
  const missileTargetPosition = Earth.geoCoordinatesToPosition(180, 0);

  const toTargetIncline = missileInitialPosition
    .clone()
    .sub(missileTargetPosition)
    .normalize();

  it('should match the velocity according to the Tsiolkovsky missile equation', () => {
    const missilePayloadMass = 1000;
    const missileFuelMass = 18400;
    const exhaustVelocity = 3;
    const massFlowRate = 50;

    const missile = new Missile(
      earth,
      missileInitialPosition,
      toTargetIncline,
      1,
      1,
      THREE.MathUtils.degToRad(0.5),
      missileFuelMass,
      exhaustVelocity,
      massFlowRate,
      missilePayloadMass
    );

    const simulatedFlightTime = missileFuelMass / massFlowRate; // seconds

    for (let tick = 0; tick < simulatedFlightTime; tick++) {
      missile.update();
    }

    // Tsiolkovsky: Δv = ve * ln(m0 / mf)
    const m0 = missileFuelMass + missilePayloadMass;
    const mf = missilePayloadMass;
    const gravityAtSurface =
      (Earth.G * Earth.MASS * 0.001) / (Earth.RADIUS * 1000) ** 2;
    const expectedDeltaV =
      exhaustVelocity * Math.log(m0 / mf) -
      gravityAtSurface * simulatedFlightTime;
    const actualSpeed = missile.velocity.length();

    expect(actualSpeed).toBeCloseTo(expectedDeltaV, 0);
  });
});
