import { FolderApi, Pane } from 'tweakpane';
import Rocket from './Rocket';
import RocketView from './RocketView';
import * as THREE from 'three';
import { formatSeconds } from 'app/utils';

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

  onFocusCameraClick: () => void = () => {};

  constructor(
    private readonly pane: Pane,
    private readonly paneContainer: HTMLElement,
    private readonly rocket: Rocket,
    private readonly rocketView: RocketView
  ) {
    this.folder = this.pane.addFolder({
      title: `Missile ${this.rocket.id}`,
      expanded: true,
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
      max: this.rocket.maxThrust,
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

    this.folder.addBinding(this.rocket, 'fuelCombustionTime', {
      label: 'Fuel Combustion Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
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
      label: 'Angle of attack Velocity',
      readonly: true,
      format: (v) => v.toFixed(2) + '°',
    });

    this.folder.addBinding(this.rocket, 'thrustInclineAngle', {
      label: 'Angle of attack Thrust',
      readonly: true,
      format: (v) => THREE.MathUtils.radToDeg(v).toFixed(2) + '°',
    });

    this.folder
      .addButton({
        title: 'Focus on Missile',
      })
      .on('click', () => {
        this.onFocusCameraClick();
      });
  }

  scrollToEnd() {
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
