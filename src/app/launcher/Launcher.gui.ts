import { formatSeconds } from 'app/utils';
import * as THREE from 'three';
import { FolderApi, Pane } from 'tweakpane';

export default class LauncherGui {
  private folder: FolderApi;

  startInclineAfterDistance = 0;
  currentThrustInclineDuration = 0;
  thrustInclineVelocity = 0;
  fuelCombustionTime = 0;
  maxAltitude = 0;
  travelledDistance = 0;
  flightTime = 0;
  minimizeFlightTime = false;

  startLongitude: number | string = 'N/A';
  startLatitude: number | string = 'N/A';

  rocketCount = 0;
  rocketSizeMultiplier = 1;

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Launcher',
      expanded: true,
    });

    this.folder
      .addBinding(this, 'minimizeFlightTime', {
        label: 'Minimize Flight Time',
        view: 'checkbox',
        input: 'checkbox',
      })
      .on('change', (ev) => {
        this.minimizeFlightTime = ev.value;
      });

    this.folder.addBinding(this, 'startInclineAfterDistance', {
      label: 'Start Incline After Altitude',
      readonly: true,
      format: (v) => {
        if (typeof v === 'number') {
          return `${v.toFixed(2)} km`;
        }
        return v;
      },
    });

    this.folder.addBinding(this, 'currentThrustInclineDuration', {
      label: 'Gravity Turn Duration',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
    });

    this.folder.addBinding(this, 'thrustInclineVelocity', {
      label: 'Gravity Turn Velocity',
      readonly: true,
      format: (v) => {
        if (typeof v === 'number') {
          return `${THREE.MathUtils.radToDeg(v).toFixed(2)}° deg/s`;
        }
        return v;
      },
    });

    this.folder.addBinding(this, 'fuelCombustionTime', {
      label: 'Fuel Combustion Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
    });

    this.folder.addBinding(this, 'maxAltitude', {
      label: 'Max Altitude',
      readonly: true,
      format: (v) => {
        if (typeof v === 'number') {
          return `${v.toFixed(2)} km`;
        }
        return v;
      },
    });

    this.folder.addBinding(this, 'travelledDistance', {
      label: 'Travelled Distance',
      readonly: true,
      format: (v) => {
        if (typeof v === 'number') {
          return `${v.toFixed(2)} km`;
        }
        return v;
      },
    });

    this.folder.addBinding(this, 'flightTime', {
      label: 'Flight Time',
      readonly: true,
      format: (v) => {
        const formatted = formatSeconds(v);

        return `${formatted.value.toFixed(1)} ${formatted.unit}`;
      },
    });

    this.folder.addBinding(this, 'rocketCount', {
      label: 'Rocket Count',
      readonly: true,
      format: (v) => {
       return `${v.toFixed(0)} rockets`;
      },
    });

    this.folder.addBinding(this, 'rocketSizeMultiplier', {
      label: 'Rocket Size Multiplier',
      min: 1,
      max: 100,
      step: 0.1,
      format: (v) => {
        return `${v.toFixed(1)} X`;
      },
    });
  }
}
