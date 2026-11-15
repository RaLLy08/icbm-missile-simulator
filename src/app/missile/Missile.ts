import * as THREE from 'three';
import Earth from '../earth/Earth';

class Missile {
  id = 0;

  /**
   * Unit: km
   */
  position = new THREE.Vector3(0, 0, 0);
  /**
   * Unit: km
   */
  travelledDistance = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: km/s
   */
  velocity = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: km/s^2
   */
  thrust = new THREE.Vector3(0, 0, 0);

  gravityForce = new THREE.Vector3(0, 0, 0);

  // Reusable vectors to avoid allocations in hot paths
  private _tempVec1 = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector3();
  private _tempVec3 = new THREE.Vector3();

  /**
   * Unit: km
   */
  altitude = 0;
  /**
   * Unit: km
   */
  maxAltitude = 0;

  /**
   * Unit: kg
   */
  mass = 1;

  /**
   * Time passed after launch
   * Unit: seconds
   */
  flightTime = 0;

  /**
   * Indicates whether the missile has finished its flight. (has displacement > 0.5 and altitude < 0)
   */
  hasLanded = false;

  /**
   * Time needed to burn all fuel.
   * Unit: seconds
   */
  fuelCombustionTime = 0;
  currentTotalMass = 0;

  /**
   * Fuel burnt since launch. Tracked incrementally, so the engine
   * parameters may change during the flight (see MultiStageMissile).
   * Unit: kg
   */
  burntFuel = 0;

  /**
   * Creates a new Missile instance.
   * @param earth The Earth instance to which the missile is associated.
   * @param initialPosition The initial position of the missile in 3D space.
   * @param targetInclineVector Thrust straight-line direction (Euclidean) towards the target.
   * @param startInclineAfterAltitude The distance after which the missile starts to incline
   * @param thrustInclineMaxDuration The maximum duration for the thrust incline
   * @param thrustInclineVelocity The velocity of the thrust incline in radians per second
   * @param fuelMass The mass of the missile fuel in kilograms
   * @param exhaustVelocity The exhaust velocity of the missile in kilometers per second
   * @param massFlowRate The mass flow rate of the missile in kilograms per second
   * @param payloadMass The mass of the missile payload in kilograms
   */
  constructor(
    private earth: Earth,
    public readonly initialPosition: THREE.Vector3,
    public readonly targetInclineVector: THREE.Vector3,
    public readonly startInclineAfterAltitude: number = 8,
    public readonly thrustInclineMaxDuration: number = 160,
    public readonly thrustInclineVelocity: number = THREE.MathUtils.degToRad(
      0.5
    ),
    public fuelMass = 18400,
    public exhaustVelocity = 3, // km/s
    public massFlowRate = 50, // kg/s
    public readonly payloadMass = 800 // kg
  ) {
    this.initialPosition = initialPosition;
    this.position.copy(this.initialPosition);

    this.fuelCombustionTime = this.fuelMass / this.massFlowRate;
    this.currentTotalMass = this.payloadMass + this.fuelMass;
  }

  /** Unit: kg */
  get remainingFuel() {
    return Math.max(this.fuelMass - this.burntFuel, 0);
  }

  currentThrustInclineDuration = 0;
  /**
   * Unit: radians
   */
  thrustInclineAngle = 0;

  /**
   * True while the gravity turn is in progress (started and not yet finished).
   */
  get isGravityTurnActive(): boolean {
    return (
      this.currentThrustInclineDuration > 0 &&
      this.currentThrustInclineDuration <= this.thrustInclineMaxDuration
    );
  }

  /**
   * True once all fuel is burnt and the engines have stopped.
   */
  get isEngineCutoff(): boolean {
    return this.remainingFuel <= 0;
  }

  /**
   * The maximum acceleration the current engine can achieve (at burnout mass = payload).
   * @returns Maximum acceleration in km/s².
   */
  get maxAcceleration() {
    return (this.massFlowRate * this.exhaustVelocity) / this.payloadMass;
  }

  /**
   * @param tick The time step for the simulation, in seconds.
   * @param targetFlatThrustDirection The target direction for the thrust, in 3D space.
   */
  setThrust(tick: number, targetFlatThrustDirection: THREE.Vector3) {
    const ve = this.exhaustVelocity; // Exhaust velocity (km/s)
    const dmdt = this.massFlowRate; // Mass flow rate (kg/s)
    const F = dmdt * ve; // Thrust (kg*(km/s²))
    const remainingFuel = this.remainingFuel;
    const mT = this.payloadMass + remainingFuel; // Current mass of the missile (kg)

    this.currentTotalMass = mT;

    if (remainingFuel <= 0) {
      this.thrust.set(0, 0, 0);
      return;
    }

    // Burn fuel for this step; the thrust uses the mass at its start
    this.burntFuel += Math.min(dmdt * tick, remainingFuel);

    const thrust = F / mT;

    // --- 1. Initial thrust direction is opposite of gravity ---
    // Reuse _tempVec1 for gravityDirection
    this._tempVec1.copy(this.gravityForce).normalize();
    // Reuse _tempVec2 for baseThrustDirection
    this._tempVec2.copy(this._tempVec1).negate();

    // --- 3. Gradual interpolation between gravity-opposite and toTarget ---
    if (
      this.altitude > this.startInclineAfterAltitude &&
      this.currentThrustInclineDuration <= this.thrustInclineMaxDuration
    ) {
      this.currentThrustInclineDuration += tick;
    }

    this.thrustInclineAngle =
      this.thrustInclineVelocity * this.currentThrustInclineDuration;

    // Compute axis of rotation - reuse _tempVec3
    this._tempVec3
      .copy(this._tempVec2)
      .cross(targetFlatThrustDirection)
      .normalize();

    // Apply the rotation directly to thrust vector
    this.thrust
      .copy(this._tempVec2)
      .applyAxisAngle(this._tempVec3, this.thrustInclineAngle)
      .multiplyScalar(thrust);
  }

  private _cachedThrustDirection = new THREE.Vector3();

  calcThrustDirectionToIncline() {
    const gravityDir = this.earth.gravityForce(this.position);
    this._tempVec1.copy(gravityDir).normalize();

    // 3. Project targetInclineVector onto the plane perpendicular to gravity
    this._cachedThrustDirection
      .copy(this.targetInclineVector)
      .projectOnPlane(this._tempVec1)
      .normalize();

    return this._cachedThrustDirection;
  }

  update(tick = 1) {
    this.setAltitude();
    this.gravityForce = this.earth.gravityForce(this.position);

    this.setThrust(tick, this.calcThrustDirectionToIncline());

    const displacementMagnitude = this.displacement.length();

    // todo fix (if too high time multiplier)
    if (displacementMagnitude > 10 && this.altitude <= 0) {
      this.velocity.set(0, 0, 0);
      this.thrust.set(0, 0, 0);
      this.hasLanded = true;

      return;
    }

    if (
      this.thrust.length() > this.gravityForce.length() ||
      this.velocity.length() !== 0
    ) {
      // Use temp vectors to avoid allocations
      this._tempVec1.copy(this.gravityForce).multiplyScalar(tick);
      this.velocity.add(this._tempVec1);

      this._tempVec2.copy(this.thrust).multiplyScalar(tick);
      this.velocity.add(this._tempVec2);

      this._tempVec1.copy(this.velocity).multiplyScalar(tick);
      this.position.add(this._tempVec1);

      // Update travelled distance
      this._tempVec1
        .set(
          Math.abs(this.velocity.x),
          Math.abs(this.velocity.y),
          Math.abs(this.velocity.z)
        )
        .multiplyScalar(tick);
      this.travelledDistance.add(this._tempVec1);
    }

    this.flightTime += tick;
  }

  private setAltitude() {
    this.altitude = this.earth.calcAltitude(this.position);
    if (this.altitude > this.maxAltitude) {
      this.maxAltitude = this.altitude;
    }
  }

  private _displacement = new THREE.Vector3();

  get displacement() {
    return this._displacement.copy(this.position).sub(this.initialPosition);
  }
}

export default Missile;
