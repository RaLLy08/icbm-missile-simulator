import * as THREE from 'three';
import Earth from '../earth/Earth';
import { type DefenseSpec } from './DefenseDatabase';

export default class Interceptor {
  id: number;
  position = new THREE.Vector3(0, 0, 0);
  prevPosition = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3(0, 0, 0);
  thrust = new THREE.Vector3(0, 0, 0);
  gravityForce = new THREE.Vector3(0, 0, 0);
  altitude = 0;
  flightTime = 0;
  hasIntercepted = false;
  hasExpired = false;
  private fuelRemaining: number;
  private _tempVec = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector3();
  private _aimPoint = new THREE.Vector3();

  constructor(
    private earth: Earth,
    startPosition: THREE.Vector3,
    private spec: DefenseSpec,
    public targetPosition: () => THREE.Vector3,
    public targetVelocity: () => THREE.Vector3,
    id: number,
    public targetId: number = -1
  ) {
    this.id = id;
    this.position.copy(startPosition);
    this.prevPosition.copy(startPosition);
    this.fuelRemaining = spec.interceptorFuelMass;
  }

  update(tick: number) {
    if (this.hasIntercepted || this.hasExpired) return;

    this.prevPosition.copy(this.position);
    this.flightTime += tick;

    this.setAltitude();
    this.gravityForce = this.earth.gravityForce(this.position);

    if (this.fuelRemaining > 0) {
      const targetPos = this.targetPosition();
      const targetVel = this.targetVelocity();

      // Time-of-arrival estimate: distance divided by closing speed.
      // Cap at the interceptor's remaining burn time so we don't lead
      // so far ahead that the aim point is unreachable.
      const dist = this.position.distanceTo(targetPos);
      const toTargetNorm = this._tempVec2.copy(targetPos).sub(this.position);
      if (dist > 0) toTargetNorm.divideScalar(dist);
      const closingSpeed = Math.max(
        this.velocity.dot(toTargetNorm) + 0.5,
        0.5
      );
      const burnTime = this.spec.interceptorFuelMass / this.spec.interceptorMassFlowRate;
      const toa = Math.min(dist / closingSpeed, burnTime);
      this._aimPoint.copy(targetPos).addScaledVector(targetVel, toa);

      const toTarget = this._tempVec.copy(this._aimPoint).sub(this.position).normalize();

      const m0 = this.spec.interceptorFuelMass + this.spec.interceptorPayloadMass;
      const mT = m0 - this.spec.interceptorMassFlowRate * this.flightTime;

      if (mT <= this.spec.interceptorPayloadMass) {
        this.fuelRemaining = 0;
        this.thrust.set(0, 0, 0);
      } else {
        const F = this.spec.interceptorMassFlowRate * this.spec.interceptorExhaustVelocity;
        const accel = F / mT;
        this.thrust.copy(toTarget).multiplyScalar(accel);
        this.fuelRemaining -= this.spec.interceptorMassFlowRate * tick;
      }
    } else {
      this.thrust.set(0, 0, 0);
    }

    this._tempVec.copy(this.gravityForce).multiplyScalar(tick);
    this.velocity.add(this._tempVec);

    this._tempVec.copy(this.thrust).multiplyScalar(tick);
    this.velocity.add(this._tempVec);

    this._tempVec.copy(this.velocity).multiplyScalar(tick);
    this.position.add(this._tempVec);
  }

  checkIntercept(targetPos: THREE.Vector3, threshold: number = 15): boolean {
    if (this.hasIntercepted || this.hasExpired) return false;

    const dist = this._pointToSegmentDistance(targetPos, this.prevPosition, this.position);
    if (dist < threshold) {
      this.hasIntercepted = true;
      return true;
    }
    return false;
  }

  private _pointToSegmentDistance(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = this._tempVec.copy(b).sub(a);
    const ap = this._tempVec2.copy(p).sub(a);
    const abLenSq = ab.lengthSq();
    if (abLenSq === 0) return p.distanceTo(a);
    let t = ap.dot(ab) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    const closest = ab.multiplyScalar(t).add(a);
    return p.distanceTo(closest);
  }

  checkExpired(): boolean {
    if (this.hasIntercepted || this.hasExpired) return true;
    if (this.flightTime > 120 && this.fuelRemaining <= 0) {
      this.hasExpired = true;
      return true;
    }
    return false;
  }

  private setAltitude() {
    this.altitude = this.earth.calcAltitude(this.position);
  }
}
