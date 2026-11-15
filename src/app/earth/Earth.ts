import { atmosphereLayerKeys } from './earth.consts';
import * as THREE from 'three';

class Earth {
  /**
   * Unit: m
   */
  static readonly RADIUS = 6_378_000;
  /** Unit: m³/(kg·s²) */
  static readonly G = 6.6743e-11;
  /**
   * Unit: kg
   */
  static readonly MASS = 5.972e24;

  /**
   * Unit: m/s²
   * Gravitational acceleration at the surface of the Earth.
   */
  // static readonly GRAVITY_AT_SURFACE =
  //   (Earth.G * Earth.MASS) / Earth.RADIUS ** 2;

  /** Unit: m */
  static readonly atmosphereLayersHeights = Object.freeze({
    [atmosphereLayerKeys.TROPOSPHERE]: 10_000,
    [atmosphereLayerKeys.STRATOSPHERE]: 50_000,
    [atmosphereLayerKeys.MESOSPHERE]: 85_000,
    [atmosphereLayerKeys.THERMOSPHERE]: 600_000,
    [atmosphereLayerKeys.EXOSPHERE]: 1_000_000,
  });

  constructor(public position = new THREE.Vector3(0, 0, 0)) {}

  // private createSphereEdges(radius: number, color: number, segmentCount: number = 128): THREE.LineSegments {
  //   const geo = new THREE.EdgesGeometry(
  //     new THREE.SphereGeometry(radius, segmentCount, segmentCount)
  //   );
  //   const mat = new THREE.LineBasicMaterial({ color: color });
  //   const lineSegments = new THREE.LineSegments(geo, mat);

  //   return lineSegments;
  // }
  
  /**
   * Calculates the gravitational force exerted by the Earth on a target point.
   * @param target The position of the target in 3D space.
   * @returns The gravitational acceleration vector in m/s².
   */
  gravityForce(target: THREE.Vector3): THREE.Vector3 {
    const earthGravityVector = new THREE.Vector3()
      .subVectors(this.position, target) // Earth - Missile
      .normalize();

    const distanceToMissile = this.position.distanceTo(target); // m

    const gravityForceMagnitude = (Earth.G * Earth.MASS) / distanceToMissile ** 2;

    return earthGravityVector.multiplyScalar(gravityForceMagnitude);
  }

  /**
   * @returns The distance to the surface of the Earth in meters.
   */
  calcAltitude(position: THREE.Vector3): number {
    const distanceToEarthCenters = this.position.distanceTo(position);
    return distanceToEarthCenters - Earth.RADIUS;
  }

  update(tick = 1) {
    // rotate the Earth around its axis
  }

  static geoCoordinatesToPosition(
    latitude: number,
    longitude: number
  ): THREE.Vector3 {
    const latRad = latitude * (Math.PI / 180);
    const lonRad = longitude * (Math.PI / 180);

    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);

    const x = Earth.RADIUS * cosLat * cosLon;
    const y = Earth.RADIUS * sinLat;
    const z = Earth.RADIUS * cosLat * sinLon;

    return new THREE.Vector3(x, y, z);
  }

  static positionToGeoCoordinates(position: THREE.Vector3): {
    latitude: number;
    longitude: number;
  } {
    const radius = position.length(); // distance from Earth's center

    const latitude = Math.asin(position.y / radius) * (180 / Math.PI);
    const longitude = Math.atan2(position.z, position.x) * (180 / Math.PI);

    return { latitude, longitude };
  }
}

export default Earth;
