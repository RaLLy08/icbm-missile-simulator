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

  it('should match the velocity according the Tsiolkovsky rocket equation', () => {
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
      rocketPayloadMass,
      rocketFuelMass,
      exhaustVelocity,
      massFlowRate
    );

    const simulatedFlightTime = 60 * 2; // seconds

    for (let tick = 0; tick < simulatedFlightTime; tick++) {
      rocket.update();
       console.log(rocket.velocity);
    }

    console.log(rocket.velocity);

  });
});
