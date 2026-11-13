import * as THREE from 'three';
import Earth from './earth/Earth';
import { FlightTrajectory, decodeGenome } from './FlightTrajectory';

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
        stages: [
          {
            stage: 0,
            exhaustVelocity: { min: 2, max: 4 },
            massFlowRate: { min: 100, max: 400 },
            fuelMass: { min: 1000, max: 30000 },
          },
          {
            stage: 1,
            exhaustVelocity: { min: 2, max: 4 },
            massFlowRate: { min: 100, max: 200 },
            fuelMass: { min: 1000, max: 4000 },
          },
        ],
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
    expect(bestGenome.multiStageRocket.stages).toHaveLength(2);
  }, 120_000);

  it('decodes per-stage genes in stage order', () => {
    const decoded = decodeGenome([1, 2, 3, 3.5, 300, 20000, 2.5, 150, 2000]);

    expect(decoded.startInclineAfterDistance).toBe(1);
    expect(decoded.thrustInclineMaxDuration).toBe(2);
    expect(decoded.thrustInclineVelocity).toBe(3);
    expect(decoded.stages).toEqual([
      { exhaustVelocity: 3.5, massFlowRate: 300, fuelMass: 20000 },
      { exhaustVelocity: 2.5, massFlowRate: 150, fuelMass: 2000 },
    ]);
  });
});
