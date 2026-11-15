import * as THREE from 'three';
import Earth from './Earth';

describe('Earth atmosphere', () => {
  const earth = new Earth();

  it('has sea level air density at the surface', () => {
    expect(Earth.airDensity(0)).toBeCloseTo(1.225, 5);
  });

  it('decreases air density with altitude', () => {
    const altitudes = [0, 10_000, 50_000, 100_000, 300_000, 900_000];
    const densities = altitudes.map((h) => Earth.airDensity(h));

    for (let i = 1; i < densities.length; i++) {
      expect(densities[i]).toBeLessThan(densities[i - 1]);
    }
  });

  it('matches standard atmosphere values', () => {
    // US Standard Atmosphere 1976 (approximate, within 10%)
    expect(Earth.airDensity(10_000)).toBeCloseTo(0.4135, 3);
    expect(Earth.airDensity(7_500) / 0.5571).toBeCloseTo(1, 1);
    expect(Earth.airDensity(50_000) / 1.027e-3).toBeCloseTo(1, 1);
    expect(Earth.airDensity(100_000) / 5.6e-7).toBeCloseTo(1, 0);
  });

  it('is continuous at the table boundaries', () => {
    for (const h of [25_000, 50_000, 100_000, 150_000]) {
      const below = Earth.airDensity(h - 1);
      const above = Earth.airDensity(h);
      expect(Math.abs(below - above) / above).toBeLessThan(0.1);
    }
  });

  it('has no air above the atmosphere', () => {
    expect(Earth.airDensity(Earth.ATMOSPHERE_TOP + 1)).toBe(0);
  });

  it('exerts no drag when atmospheric drag is disabled', () => {
    const noDragEarth = new Earth();
    noDragEarth.atmosphericDragEnabled = false;
    const position = new THREE.Vector3(Earth.RADIUS + 1000, 0, 0);
    const drag = noDragEarth.dragForce(position, new THREE.Vector3(0, 300, 0), 0.3, 2, 1000);

    expect(drag.length()).toBe(0);
    expect(noDragEarth.airDensityAt(position)).toBeGreaterThan(0);
  });

  it('computes drag opposite to the velocity, growing with speed²', () => {
    const position = new THREE.Vector3(Earth.RADIUS + 1000, 0, 0);
    const slow = earth.dragForce(position, new THREE.Vector3(0, 100, 0), 0.3, 2, 1000);
    const fast = earth.dragForce(position, new THREE.Vector3(0, 200, 0), 0.3, 2, 1000);

    expect(slow.y).toBeLessThan(0);
    expect(fast.length() / slow.length()).toBeCloseTo(4, 5);

    // a = ½·ρ·v²·Cd·A / m
    const expected = (0.5 * Earth.airDensity(1000) * 100 ** 2 * 0.3 * 2) / 1000;
    expect(slow.length()).toBeCloseTo(expected, 8);
  });
});
