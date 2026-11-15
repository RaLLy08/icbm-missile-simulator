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
    const exhaustVelocity = 3000; // m/s
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
    // Tsiolkovsky equation is for vacuum
    missile.dragCoefficient = 0;

    const simulatedFlightTime = missileFuelMass / massFlowRate; // seconds

    for (let tick = 0; tick < simulatedFlightTime; tick++) {
      missile.update();
    }

    // Tsiolkovsky: Δv = ve * ln(m0 / mf)
    const m0 = missileFuelMass + missilePayloadMass;
    const mf = missilePayloadMass;
    const gravityAtSurface =
      (Earth.G * Earth.MASS) / Earth.RADIUS ** 2; // m/s²
    const expectedDeltaV =
      exhaustVelocity * Math.log(m0 / mf) -
      gravityAtSurface * simulatedFlightTime;
    const actualSpeed = missile.velocity.length();

    expect(actualSpeed).toBeCloseTo(expectedDeltaV, -3); // within 500 m/s
  });

  describe('atmospheric drag', () => {
    // Engine strong enough to lift off right away (thrust > gravity)
    const createMissile = () =>
      new Missile(
        earth,
        missileInitialPosition,
        toTargetIncline,
        undefined,
        undefined,
        undefined,
        18400,
        3000,
        150
      );

    it('slows the missile down compared to a flight in vacuum', () => {
      const withDrag = createMissile();
      const vacuum = createMissile();
      vacuum.dragCoefficient = 0;

      for (let t = 0; t < 120; t++) {
        withDrag.update();
        vacuum.update();
      }

      expect(withDrag.velocity.length()).toBeLessThan(
        vacuum.velocity.length()
      );
    });

    it('points opposite to the velocity', () => {
      const missile = createMissile();
      for (let t = 0; t < 60; t++) missile.update();

      expect(missile.dragForce.length()).toBeGreaterThan(0);
      expect(missile.dragForce.angleTo(missile.velocity)).toBeCloseTo(
        Math.PI,
        5
      );
    });

    it('is fully off when disabled on the Earth (no drag, no air density)', () => {
      const noDragEarth = new Earth();
      noDragEarth.atmosphericDragEnabled = false;
      const missile = new Missile(
        noDragEarth,
        missileInitialPosition,
        toTargetIncline,
        undefined,
        undefined,
        undefined,
        18400,
        3000,
        150
      );
      for (let t = 0; t < 60; t++) missile.update();

      expect(missile.velocity.length()).toBeGreaterThan(0);
      expect(missile.dragForce.length()).toBe(0);
      expect(missile.airDensity).toBe(0);
    });

    it('vanishes outside the atmosphere', () => {
      const missile = createMissile();
      missile.position.set(Earth.RADIUS + 2_000_000, 0, 0);
      missile.velocity.set(0, 7000, 0);
      missile.fuelMass = 0;

      missile.update();

      expect(missile.airDensity).toBe(0);
      expect(missile.dragForce.length()).toBe(0);
    });

    it('never reverses the velocity, even for large ticks', () => {
      const missile = createMissile();
      missile.position.set(Earth.RADIUS + 1000, 0, 0);
      const velocity = new THREE.Vector3(0, 7000, 0);
      missile.velocity.copy(velocity);
      missile.fuelMass = 0;

      missile.update(100);

      expect(missile.velocity.dot(velocity)).toBeGreaterThan(0);
    });
  });
});
