import { FolderApi, Pane } from 'tweakpane';
import Rocket from './Rocket';
import MultiStageRocket from './MultiStageRocket';
import RocketView from './RocketView';
import * as THREE from 'three';
import { formatSeconds } from 'app/utils';
import RocketTrackingView from './RocketTrackingView';

export default class RocketGui {
  private folder: FolderApi;
  // Public: the main view mirrors this camera while chasing the missile
  readonly trackingView: RocketTrackingView;
  velocity = 0;
  thrust = 0;
  displacement = 0;
  gravityForce = 0;
  percentOfFuel = 0;
  showForcesArrows = false;
  forcesArrowViewScale = 1;
  travelledDistance = 0;
  velocityToGravityAngle = 0;
  thrustInclineAngleDeg = 0;

  onFocusCameraClick: () => void = () => {};

  private readonly rocket: Rocket;

  // The tracking camera's smoothing runs on wall-clock time, also while
  // time is paused (its delta is only used for the camera).
  readonly usesRealTime = true;

  constructor(
    private readonly pane: Pane,
    private readonly paneContainer: HTMLElement,
    private readonly multiStageRocket: MultiStageRocket,
    private readonly rocketView: RocketView,
    scene: THREE.Scene
  ) {
    this.rocket = multiStageRocket.rocket;

    this.folder = this.pane.addFolder({
      title: `Missile ${this.rocket.id}`,
      expanded: true,
    });

    // Live camera viewport tracking the missile
    this.trackingView = new RocketTrackingView(scene, this.rocketView);

    // First blade in the folder -> stays on top
    const cameraViewBinding = this.folder.addBinding(
      this.trackingView,
      'mode',
      {
        label: 'Camera View',
        options: {
          Chase: 'chase',
          'First-Person': 'fpv',
        },
      }
    );

    this.folder
      .addButton({
        title: 'Chase Missile',
      })
      .on('click', () => {
        this.onFocusCameraClick();
      });

    this.folder.addBinding(this, 'velocity', {
      label: 'Velocity',
      readonly: true,
      format: (v) => v.toFixed(5) + ' km/s',
    });

    this.folder.addBinding(this, 'thrust', {
      label: 'Thrust Graph (N)',
      readonly: true,
      view: 'graph',
      min: 0,
      max: this.rocket.maxAcceleration,
      format: (v) => (v * 1000).toFixed(5) + ' kg*(m/s²)',
    });

    this.folder.addBinding(this, 'thrust', {
      label: 'Thrust (N)',
      readonly: true,
      format: (v) => (v / this.gravityForce).toFixed(2) + ' g',
    });

    this.folder.addBinding(this, 'percentOfFuel', {
      label: 'Percent of Fuel',
      readonly: true,
      format: (v) => v.toFixed(2) + '%',
    });

    this.folder.addBinding(this.multiStageRocket, 'currentStageIndex', {
      label: 'Stage',
      readonly: true,
      format: (v) => {
        const count = this.multiStageRocket.stages.length;
        return v >= count
          ? `burnt out (${count} stages)`
          : `${v + 1} / ${count}`;
      },
    });

    this.folder.addBinding(this, 'velocityToGravityAngle', {
      label: 'Angle of attack Velocity',
      view: 'cameraring',
      readonly: true,
      wide: true,
      format: (v) => v.toFixed(2) + '°',
    });

    // Camerakit's ring is an input-only view (no readonly/monitor mode), so it
    // binds to a degree mirror that update() overwrites every frame.
    this.folder.addBinding(this, 'thrustInclineAngleDeg', {
      label: 'Angle of attack Incline Thrust',
      view: 'cameraring',
      series: 0,
      wide: true,
      format: (v: number) => v.toFixed(2) + '°',
    });

    this.folder.addBinding(this.rocket, 'fuelCombustionTime', {
      label: 'Fuel Combustion Time',
      readonly: true,
      format: (v) => formatSeconds(v),
    });

    this.folder.addBinding(this.rocket, 'currentTotalMass', {
      label: 'Fuel Mass',
      readonly: true,
      format: (v) => (v - this.rocket.payloadMass).toFixed(1) + ' kg',
    });

    this.folder.addBinding(this.rocket, 'payloadMass', {
      label: 'Payload Mass',
      readonly: true,
      format: (v) => v.toFixed(1) + ' kg',
    });

    this.folder.addBinding(this, 'displacement', {
      label: 'Displacement',
      readonly: true,
      format: (v) => v.toFixed(1) + ' km',
    });

    this.folder.addBinding(this.rocket, 'altitude', {
      label: 'Altitude',
      readonly: true,
      format: (v) => v.toFixed(1) + ' km',
    });

    this.folder.addBinding(this, 'gravityForce', {
      label: 'Gravity',
      readonly: true,
      format: (v) => v.toExponential(5) + ' km/s²',
    });

    this.folder.addBinding(this.rocket, 'currentThrustInclineDuration', {
      label: 'Thrust Gravity Turn Duration',
      readonly: true,
      format: (v) => v.toFixed(1) + ' s',
    });

    this.folder.addBinding(this.rocket, 'flightTime', {
      label: 'Flight Time',
      readonly: true,
      format: (v) => formatSeconds(v),
    });

    this.folder.addBinding(this, 'travelledDistance', {
      label: 'Travelled Distance',
      readonly: true,
      format: (v) => v.toFixed(1) + ' km',
    });

    this.folder
      .addBinding(this, 'showForcesArrows', {
        label: 'Show Forces Arrows',
      })
      .on('change', () => {
        this.rocketView.setArrowsEnabled(this.showForcesArrows);
      });

    this.folder
      .addBinding(this, 'forcesArrowViewScale', {
        label: 'Forces Arrow View Scale',
        min: 1,
        max: 3000,
        step: 1,
      })
      .on('change', () => {
        this.rocketView.applyScaleToArrows(this.forcesArrowViewScale);
      });

    // Insert the viewport into the DOM only after all blades are added:
    // tweakpane inserts blades by child index, so a foreign element added
    // earlier would get pushed to the bottom.
    cameraViewBinding.element.after(this.trackingView.element);
  }

  scrollToEnd() {
    this.paneContainer.scrollTo(0, this.paneContainer.scrollHeight);
  }

  update(deltaTime = 0) {
    this.trackingView.update(deltaTime);

    this.velocity = this.rocket.velocity.length();
    this.thrust = this.rocket.thrust.length();

    this.displacement = this.rocket.displacement.length();
    this.gravityForce = this.rocket.gravityForce.length();
    this.travelledDistance = this.rocket.travelledDistance.length();
    this.percentOfFuel =
      this.rocket.fuelMass > 0
        ? (this.rocket.remainingFuel / this.rocket.fuelMass) * 100
        : 0;

    this.velocityToGravityAngle =
      this.rocket.velocity.length() > 0
        ? THREE.MathUtils.radToDeg(
            this.rocket.velocity.clone().angleTo(this.rocket.gravityForce)
          )
        : 0;

    this.thrustInclineAngleDeg = THREE.MathUtils.radToDeg(
      this.rocket.thrustInclineAngle
    );

    this.folder.refresh();
  }

  remove() {
    this.trackingView.dispose();
    this.folder.dispose();
  }
}
