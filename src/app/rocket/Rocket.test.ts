import * as THREE from 'three';
import Rocket from './Rocket';
import Earth from '../earth/Earth';

describe('Rocket', () => {
  const earth = new Earth();
  const rocketInitialPosition = Earth.geoCoordinatesToPosition(0, 0);
  const rocketTargetPosition = Earth.geoCoordinatesToPosition(180, 0);

  const toTargetIncline = rocketInitialPosition.clone().sub(rocketTargetPosition).normalize();

  const fuelCombustionTime1Step = 1000; // seconds
  const rocket1Step = new Rocket(
    earth,
    rocketInitialPosition,
    toTargetIncline,
    0, // startInclineAfterDistance
    0, // thrustInclineMaxDuration
    0, // thrustInclineVelocity
    fuelCombustionTime1Step // fuelCombustionTime
  );
  const simulatedFlightTime1Step = fuelCombustionTime1Step / 2

  for (let i = 0; i < simulatedFlightTime1Step; i++) {
    rocket1Step.update(1);
  }

  const xDisplacement1Step = rocketInitialPosition.clone().sub(rocket1Step.position).x;
  const xThrust1Step = rocket1Step.thrust.x;
  const xVelocity1Step = rocket1Step.velocity.x;

  it('tick 1', () => {
    const rocket = new Rocket(
      earth,
      rocketInitialPosition,
      toTargetIncline,
      0, // startInclineAfterDistance
      0, // thrustInclineMaxDuration
      0, // thrustInclineVelocity
      fuelCombustionTime1Step // fuelCombustionTime
    );

    const stepInSeconds = 0.01;

    for (let i = 0; i < simulatedFlightTime1Step / stepInSeconds; i++) {
      rocket.update(stepInSeconds);
    }

    const xDisplacement = rocketInitialPosition.clone().sub(rocket.position).x;
    const xThrust = rocket.thrust.x;
    const xVelocity = rocket.velocity.x;

    console.table({
      'xDisplacement difference': Math.abs(xDisplacement - xDisplacement1Step),
      'xThrust difference': Math.abs(xThrust - xThrust1Step),
      'xVelocity difference': Math.abs(xVelocity - xVelocity1Step),
    });


    // expect(xDisplacement).toBeCloseTo(xDisplacement1Step, 3);
  });
});
