import * as THREE from 'three';
import Earth from './earth/Earth';
import { FlightTrajectory } from './FlightTrajectory';

describe('FlightTrajectory', () => {
  const earth = new Earth();
  const start = Earth.geoCoordinatesToPosition(0, 0);
  const target = Earth.geoCoordinatesToPosition(20, 10);

  const createTrajectory = () =>
    new FlightTrajectory(
      earth,
      start,
      target,
      {
        startInclineAfterDistance: { min: 1, max: 4 },
        thrustInclineMaxDuration: { min: 10, max: 40 * 60 },
        thrustInclineVelocity: {
          min: THREE.MathUtils.degToRad(0),
          max: THREE.MathUtils.degToRad(20),
        },
        fuelMass: { min: 300, max: 70000 },
        exhaustVelocity: { min: 1, max: 3 },
        massFlowRate: { min: 1, max: 100 },
      },
      {
        maxDistanceThreshold: start.distanceTo(target) * 6,
        maxFlightTimeSeconds: 60 * 120,
        maxAltitude: 6000,
      }
    );

  it('launches a rocket that lands close to the target', async () => {
    const trajectory = createTrajectory();
    const bestGenome = await trajectory.calcTrajectory(0);

    const rocket = bestGenome.rocket;
    const missDistance = rocket.position.distanceTo(target); // km

    expect(rocket.hasLanded).toBe(true);
    expect(missDistance).toBeLessThan(50);
  }, 120_000);
});
