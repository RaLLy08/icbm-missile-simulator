import { FolderApi, Pane } from 'tweakpane';
import Rocket from './Rocket';
import RocketView from './RocketView';
import * as THREE from 'three';
import { formatSeconds } from 'app/utils';
import CameraManager from 'app/helpers/CameraManager';
import EarthView from 'app/earth/EarthView';

export default class RocketGui {
  private folder: FolderApi;
  velocity = 0;
  thrust = 0;
  displacement = 0;
  gravityForce = 0;
  percentOfFuel = 0;
  forcesArrowViewScale = 1;
  travelledDistance = 0;
  velocityToGravityAngle = 0;

  constructor(
    private readonly pane: Pane,
    private readonly paneContainer: HTMLElement,
    private readonly rocket: Rocket,
    private readonly rocketView: RocketView,
    private readonly earthView: EarthView,
    private readonly cameraManager: CameraManager
  ) {
    this.folder = this.pane.addFolder({
      title: `Rocket ${this.rocket.id}`,
      expanded: true,
    });

    this.folder
      .addButton({
        title: 'Focus on Missile',
      })
      .on('click', () => {
        this.cameraManager.setRocketCamera(
          this.earthView,
          this.rocketView
        );
      });

    this.folder.addBinding(this, 'velocity', {
      label: 'Velocity',
      readonly: true,
      format: (v) => v.toFixed(5) + ' km/s',
    });

    this.folder.addBinding(this, 'thrust', {
      label: 'Thrust Graph',
      readonly: true,
      view: 'graph',
      min: 0,
      max: this.rocket.maxThrust,
      format: (v) => v.toFixed(5) + ' km/s²',
    });

    this.folder.addBinding(this, 'thrust', {
      label: 'Thrust (G)',
      readonly: true,
      min: 0,
      max: this.rocket.maxThrust,
      format: (v) => (v / this.gravityForce).toFixed(2) + ' g',
    });

    this.folder.addBinding(this, 'percentOfFuel', {
      label: 'Percent of Fuel',
      readonly: true,
      format: (v) => v.toFixed(2) + '%',
    });

    this.folder.addBinding(this.rocket, 'fuelCombustionTime', {
      label: 'Fuel Combustion Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
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

    this.folder.addBinding(this.rocket, 'thrustInclineAngle', {
      label: 'Thrust Incline Angle (degrees)',
      readonly: true,
      format: (v) => THREE.MathUtils.radToDeg(v).toFixed(5),
    });

    this.folder.addBinding(this.rocket, 'currentThrustInclineDuration', {
      label: 'Thrust Gravity Turn Duration',
      readonly: true,
      format: (v) => v.toFixed(1) + ' s',
    });

    this.folder.addBinding(this.rocket, 'flightTime', {
      label: 'Fligth Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
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

    this.folder.addBinding(this, 'travelledDistance', {
      label: 'Travelled Distance',
      readonly: true,
      format: (v) => v.toFixed(1) + ' km',
    });

    this.folder.addBinding(this, 'velocityToGravityAngle', {
      label: 'Velocity to Gravity Angle',
      readonly: true,
      format: (v) => v.toFixed(2) + '°',
    });

    this.paneContainer.scrollTo(0, this.paneContainer.scrollHeight);
  }

  update() {
    this.velocity = this.rocket.velocity.length();
    this.thrust = this.rocket.thrust.length();
    this.displacement = this.rocket.displacement.length();
    this.gravityForce = this.rocket.gravityForce.length();
    this.travelledDistance = this.rocket.travelledDistance.length();
    this.percentOfFuel =
      100 -
      (Math.min(this.rocket.flightTime, this.rocket.fuelCombustionTime) /
        this.rocket.fuelCombustionTime) *
        100;

    this.velocityToGravityAngle =
      this.rocket.velocity.length() > 0
        ? THREE.MathUtils.radToDeg(
            this.rocket.velocity.clone().angleTo(this.rocket.gravityForce)
          )
        : 0;

    this.folder.refresh();
  }

  remove() {
    this.folder.dispose();
  }
}
