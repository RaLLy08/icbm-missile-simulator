import { FolderApi, Pane } from 'tweakpane';
import Rocket from './Rocket';
import RocketView from './RocketView';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { formatSeconds } from 'app/utils';

export default class RocketGui {
  private folder: FolderApi;
  velocity = 0;
  thrust = 0;
  displacement = 0;
  gravityForce = 0;
  percentOfFuel = 0;
  forcesArrowViewScale = 100;
  travelledDistance = 0;

  constructor(
    private readonly pane: Pane,
    private readonly paneContainer: HTMLElement,
    private readonly rocket: Rocket,
    private readonly rocketView: RocketView,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: TrackballControls
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
        this.rocketView.focusCamera(this.controls, this.camera);
      });

    this.folder.addBinding(this, 'velocity', {
      label: 'Velocity',
      readonly: true,
      format: (v) => v.toFixed(5) + ' km/s',
    });

    this.folder.addBinding(this, 'thrust', {
      label: 'Thurst',
      readonly: true,
      view: 'graph',
      min: 0,
      max: this.rocket.maxThrust,
      format: (v) => v.toFixed(5) + ' km/s²',
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

    this.folder.addBinding(this, 'percentOfFuel', {
      label: 'Percent of Fuel',
      readonly: true,
      format: (v) => v.toFixed(2) + '%',
    });

    this.folder.addBinding(this.rocket, 'flightTime', {
      label: 'Fligth Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
    });

    this.folder.addBinding(this.rocket, 'fuelCombustionTime', {
      label: 'Fuel Combustion Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
    });

    this.folder
      .addBinding(this, 'forcesArrowViewScale', {
        label: 'Forces Arrow View Scale',
        min: 100,
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

    this.paneContainer.scrollTo(
      0,
      this.paneContainer.scrollHeight
    );
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

    this.folder.refresh();
  }
}
