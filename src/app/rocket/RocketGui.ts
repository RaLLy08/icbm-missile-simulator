import { FolderApi, Pane } from 'tweakpane';
import Rocket from './Rocket';
import RocketView from './RocketView';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';




// const guiAltitudeKm = satelliteFolder.addBinding(
//   guiSatelliteParams,
//   'altitudeKm',
//   {
//     label: 'Altitude (km)',
//   }
// );

// const guiPitch = satelliteFolder.addBinding(guiSatelliteParams, 'pitch', {
//   label: 'Pitch (deqrees)',
//   readonly: true,
// });

// const guiGravitiAcceleration = satelliteFolder.addBinding(
//   guiSatelliteParams,
//   'gravitiAcceleration',
//   {
//     label: 'Grav. Acceleration (km/s²)',
//     readonly: true,
//     format: (v) => v.toExponential(5),
//   }
// );


export default class RocketGui {
  private folder: FolderApi;
  velocity = 0;
  thrust = 0;
  displacement = 0;
  gravityForce = 0;
  percentOfFuel = 0;

  constructor(
    private readonly pane: Pane,
    private readonly rocket: Rocket,
    private readonly rocketView: RocketView,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: TrackballControls
  ) {
    this.folder = this.pane.addFolder({
      title: 'Rocket',
      expanded: true,
    });

    this.folder
      .addButton({
        title: 'Focus on Satellite',
      })
      .on('click', () => {
        this.rocketView.focusCamera(this.controls, this.camera);
      });

    this.folder.addBinding(this, 'velocity', {
      label: 'Velocity (km/s)',
      readonly: true,
      format: (v) => v.toFixed(5),
    });

    this.folder.addBinding(this, 'thrust', {
      label: 'Thurst (km/s²)',
      readonly: true,
      view: 'graph',
      min: 0,
      max: this.rocket.maxThrust,
      format: (v) => v.toFixed(5),
    });

    this.folder.addBinding(this, 'displacement', {
      label: 'Displacement (km)',
      readonly: true,
      format: (v) => v.toFixed(5),
    });

    this.folder.addBinding(this.rocket, 'altitude', {
      label: 'Altitude (km)',
      readonly: true,
      format: (v) => v.toFixed(5),
    });

    this.folder.addBinding(this, 'gravityForce', {
      label: 'Gravity Force (km/s²)',
      readonly: true,
      format: (v) => v.toExponential(5),
    });

    this.folder.addBinding(this.rocket, 'thrustInclineAngle', {
      label: 'Thrust Incline Angle (degrees)',
      readonly: true,
      format: (v) => THREE.MathUtils.radToDeg(v).toFixed(5),
    });

    this.folder.addBinding(this, 'percentOfFuel', {
      label: 'Percent of Fuel (%)',
      readonly: true,
      format: (v) => v.toFixed(2),
    });

    this.folder.addBinding(this.rocket, 'launchTime', {
      label: 'Launch Time (s)',
      readonly: true,
      format: (v) => v.toFixed(1),
    });


  }

  update() {
    this.velocity = this.rocket.velocity.length();
    this.thrust = this.rocket.thrust.length();
    this.displacement = this.rocket.displacement.length();
    this.gravityForce = this.rocket.gravityForce.length();
    this.percentOfFuel =
      100 - (this.rocket.launchTime / this.rocket.fuelCombustionTimeS) * 100;


    this.folder.refresh();
  }
}