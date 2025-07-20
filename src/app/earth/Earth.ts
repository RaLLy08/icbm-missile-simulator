import { atmosphereLayerKeys } from './earth.consts';
import * as THREE from 'three';


class Earth {
  /**
   * Unit: km
   */
  static readonly RADIUS = 6378;
  static readonly G = 6.6743e-11;
  static readonly EARTH_ROTATION_SPEED = (2 * Math.PI) / (24 * 60 * 60);
  /**
   * Unit: kg
   */
  static readonly MASS = 5.972e24;

  /**
   * Unit: m/s²
   * Gravitational acceleration at the surface of the Earth.
   */
  // static readonly GRAVITY_AT_SURFACE =
  //   (Earth.G * Earth.MASS * 0.001) / (Earth.RADIUS * 1000) ** 2;

  static readonly atmosphereLayersHeights = Object.freeze({
    [atmosphereLayerKeys.TROPOSPHERE]: 10,
    [atmosphereLayerKeys.STRATOSPHERE]: 50,
    [atmosphereLayerKeys.MESOSPHERE]: 85,
    [atmosphereLayerKeys.THERMOSPHERE]: 600,
    [atmosphereLayerKeys.EXOSPHERE]: 1000,
  });

  constructor(
    public position = new THREE.Vector3(0, 0, 0),
    public rotation = new THREE.Euler(0, 0, 0)
  ) {}

  // private createSphereEdges(radius: number, color: number, segmentCount: number = 128): THREE.LineSegments {
  //   const geo = new THREE.EdgesGeometry(
  //     new THREE.SphereGeometry(radius, segmentCount, segmentCount)
  //   );
  //   const mat = new THREE.LineBasicMaterial({ color: color });
  //   const lineSegments = new THREE.LineSegments(geo, mat);

  //   return lineSegments;
  // }

  gravityForce(target: THREE.Vector3): THREE.Vector3 {
    const earthGravityVector = new THREE.Vector3()
      .subVectors(this.position, target) // Earth - Rocket
      .normalize();

    const distanceToRocketMeters = this.position.distanceTo(target) * 1000; // Convert km to meters

    // Calculate gravitational force
    const gravityForceMagnitude =
      (Earth.G * Earth.MASS) / distanceToRocketMeters ** 2;

    return earthGravityVector.multiplyScalar(gravityForceMagnitude * 0.001); // Convert to km/s^2
  }

  /**
   * @returns The distance to the surface of the Earth in kilometers.
   */
  calcAltitude(position: THREE.Vector3): number {
    const distanceToEarthCenters = this.position.distanceTo(position);
    return distanceToEarthCenters - Earth.RADIUS;
  }

  update(tick = 1) {
    this.rotation.y += Earth.EARTH_ROTATION_SPEED * tick;
  }

  withRotation(
    position: THREE.Vector3,
    sign = 1
  ) {
    const rotationMatrix = new THREE.Matrix4().makeRotationY(this.rotation.y * sign);
    return position.clone().applyMatrix4(rotationMatrix);
  }

  static geoCoordinatesToPosition(
    latitude: number,
    longitude: number,
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