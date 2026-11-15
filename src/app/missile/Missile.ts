import * as THREE from 'three';
import Earth from '../earth/Earth';

class Missile {
  id = 0;

  /**
   * Unit: m
   */
  position = new THREE.Vector3(0, 0, 0);
  /**
   * Unit: m
   */
  travelledDistance = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: m/s
   */
  velocity = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: m/s²
   */
  thrust = new THREE.Vector3(0, 0, 0);

  gravityForce = new THREE.Vector3(0, 0, 0);

  /**
   * Atmospheric drag acceleration (opposite to the velocity).
   * Unit: m/s²
   */
  dragForce = new THREE.Vector3(0, 0, 0);

  /**
   * Air density at the current position.
   * Unit: kg/m³
   */
  airDensity = 0;

  /**
   * Drag coefficient Cd (dimensionless). 0 disables drag.
   */
  dragCoefficient = 0.3;

  /**
   * Frontal cross-section area (≈ 1.8 m diameter body).
   * Unit: m²
   */
  crossSectionArea = Math.PI * 0.9 ** 2;

  // Reusable vectors to avoid allocations in hot paths
  private _baseThrustDirection = new THREE.Vector3();
  private _thrustRotationAxis = new THREE.Vector3();

  /**
   * Unit: m
   */
  altitude = 0;
  /**
   * Unit: m
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
   * Indicates whether the missile has finished its flight. (has displacement > 10,000 m and altitude < 0)
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
   * @param startInclineAfterAltitude The distance after which the missile starts to incline. Unit: m
   * @param thrustInclineMaxDuration The maximum duration for the thrust incline. Unit: seconds
   * @param thrustInclineVelocity The velocity of the thrust incline. Unit: radians per second
   * @param fuelMass The mass of the missile fuel. Unit: kilograms
   * @param exhaustVelocity The exhaust velocity of the missile. Unit: meters per second
   * @param massFlowRate The mass flow rate of the missile: Unit: kilograms per second
   * @param payloadMass The mass of the missile payload. Unit: kilograms
   */
  constructor(
    private earth: Earth,
    public readonly initialPosition: THREE.Vector3,
    public readonly targetInclineVector: THREE.Vector3,
    public readonly startInclineAfterAltitude: number = 8000, // m
    public readonly thrustInclineMaxDuration: number = 160,
    public readonly thrustInclineVelocity: number = THREE.MathUtils.degToRad(
      0.5
    ),
    public fuelMass = 18400,
    public exhaustVelocity = 3000, // m/s
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
   * @returns Maximum acceleration in m/s².
   */
  get maxAcceleration() {
    return (this.massFlowRate * this.exhaustVelocity) / this.payloadMass;
  }

  /**
   * @param tick The time step for the simulation, in seconds.
   * @param targetFlatThrustDirection The target direction for the thrust, in 3D space.
   */
  setThrust(tick: number, targetFlatThrustDirection: THREE.Vector3) {
    const ve = this.exhaustVelocity; // Exhaust velocity (m/s)
    const dmdt = this.massFlowRate; // Mass flow rate (kg/s)
    const F = dmdt * ve; // Thrust (N = kg·m/s²)
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
    this._baseThrustDirection.copy(this.gravityForce).normalize().negate();

    // --- 3. Gradual interpolation between gravity-opposite and toTarget ---
    if (
      this.altitude > this.startInclineAfterAltitude &&
      this.currentThrustInclineDuration <= this.thrustInclineMaxDuration
    ) {
      this.currentThrustInclineDuration += tick;
    }

    this.thrustInclineAngle =
      this.thrustInclineVelocity * this.currentThrustInclineDuration;

    // Compute axis of rotation
    this._thrustRotationAxis
      .copy(this._baseThrustDirection)
      .cross(targetFlatThrustDirection)
      .normalize();

    // Apply the rotation directly to thrust vector
    this.thrust
      .copy(this._baseThrustDirection)
      .applyAxisAngle(this._thrustRotationAxis, this.thrustInclineAngle)
      .multiplyScalar(thrust);
  }

  private _cachedThrustDirection = new THREE.Vector3();

  calcThrustDirectionToIncline() {
    // Project targetInclineVector onto the plane perpendicular to gravity
    // (projectOnPlane doesn't require a normalized plane normal)
    this._cachedThrustDirection
      .copy(this.targetInclineVector)
      .projectOnPlane(this.gravityForce)
      .normalize();

    return this._cachedThrustDirection;
  }

  update(tick = 1) {
    this.setAltitude();
    this.gravityForce = this.earth.gravityForce(this.position);

    this.setThrust(tick, this.calcThrustDirectionToIncline());

    const displacementMagnitude = this.displacement.length();

    // todo fix (if too high time multiplier)
    if (displacementMagnitude > 10_000 && this.altitude <= 0) {
      this.velocity.set(0, 0, 0);
      this.thrust.set(0, 0, 0);
      this.hasLanded = true;

      return;
    }

    if (
      this.thrust.length() > this.gravityForce.length() ||
      this.velocity.length() !== 0
    ) {
      this.velocity.addScaledVector(this.gravityForce, tick);
      this.velocity.addScaledVector(this.thrust, tick);
      this.applyDrag(tick);
      this.position.addScaledVector(this.velocity, tick);

      // Update travelled distance
      this.travelledDistance.x += Math.abs(this.velocity.x) * tick;
      this.travelledDistance.y += Math.abs(this.velocity.y) * tick;
      this.travelledDistance.z += Math.abs(this.velocity.z) * tick;
    }

    this.flightTime += tick;
  }

  /**
   * Quadratic air drag, a = -k·|v|·v with k = ½·ρ·Cd·A / m. The density
   * depends on the altitude (distance to the Earth).
   *
   * The speed is updated with the implicit step v' = v / (1 + k·|v|·dt),
   * which stays stable for large ticks (drag can never reverse the velocity).
   */
  private applyDrag(tick: number) {
    // With atmospheric drag disabled the missile flies as in vacuum: no
    // density means no drag and no aerodynamic heating effects either
    this.airDensity = this.earth.atmosphericDragEnabled
      ? Earth.airDensity(this.altitude)
      : 0;

    const k =
      this.dragCoefficient > 0 && this.airDensity > 0
        ? this.earth.dragFactor(
            this.position,
            this.dragCoefficient,
            this.crossSectionArea,
            this.currentTotalMass
          )
        : 0;
    const speed = this.velocity.length();

    if (k === 0 || speed === 0) {
      this.dragForce.set(0, 0, 0);
      return;
    }

    const scale = 1 / (1 + k * speed * tick);
    // Effective (average) drag acceleration over the step, for display
    this.dragForce.copy(this.velocity).multiplyScalar((scale - 1) / tick);
    this.velocity.multiplyScalar(scale);
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
