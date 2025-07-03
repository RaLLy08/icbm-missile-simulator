import { formatSeconds } from 'app/utils';
import * as THREE from 'three';
import { ButtonApi, FolderApi, Pane } from 'tweakpane';

export default class LauncherGui {
  private folder: FolderApi;
  startPositionSetIsActive = false;
  targetPositionSetIsActive = false;

  private setStartButton: ButtonApi;
  private setTargetButton: ButtonApi;
  private calcTrajectoryButton: ButtonApi;
  private launchButton: ButtonApi;

  startInclineAfterDistance = 0;
  currentThrustInclineDuration = 0;
  thrustInclineVelocity = 0;
  fuelCombustionTime = 0;
  maxAltitude = 0;
  travelledDistance = 0;
  flightTime = 0;

  startLongitude: number | string = 'N/A';
  startLatitude: number | string = 'N/A';

  targetLongitude: number | string = 'N/A';
  targetLatitude: number | string = 'N/A';

  onCalculateTrajectory = () => {};
  onLaunchRocket = () => {};

  setStartPosition = ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => {
    this.startLatitude = `${latitude.toFixed(2)}°`;
    this.startLongitude = `${longitude.toFixed(2)}°`;

    this.toggleStartPositionClick();
  };

  setCalcTrajectoryButtonDisabled = (disabled: boolean) => {
    this.calcTrajectoryButton.disabled = disabled;
  };

  setTargetPosition = ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => {
    this.targetLatitude = `${latitude.toFixed(2)}°`;
    this.targetLongitude = `${longitude.toFixed(2)}°`;
    this.toggleTargetPositionClick();
  };

  readonly startPositionLabels = [
    'Set Start Position',
    'Click on Earth to set Start Position',
  ];
  readonly targetPositionLabels = [
    'Set Target Position',
    'Click on Earth to set Target Position',
  ];

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Launcher',
      expanded: true,
    });

    this.setStartButton = this.folder
      .addButton({
        title: this.startPositionLabels[0],
      })
      .on('click', (e) => {
        e.native.stopPropagation();
        this.toggleStartPositionClick();
      });

    this.folder.addBinding(this, 'startLongitude', {
      label: 'Start Longitude',
      readonly: true,
    });
    this.folder.addBinding(this, 'startLatitude', {
      label: 'Start Latitude',
      readonly: true,
    });

    this.setTargetButton = this.folder
      .addButton({
        title: this.targetPositionLabels[0],
      })
      .on('click', (e) => {
        e.native.stopPropagation();
        this.toggleTargetPositionClick();
      });

    this.folder.addBinding(this, 'targetLongitude', {
      label: 'Target Longitude',
      readonly: true,
    });

    this.folder.addBinding(this, 'targetLatitude', {
      label: 'Target Latitude',
      readonly: true,
    });

    this.calcTrajectoryButton = this.folder
      .addButton({
        title: 'Calculate Trajectory',
        disabled: true,
      })
      .on('click', async (e) => {
        e.native.stopPropagation();

        this.onCalculateTrajectory();
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

    this.launchButton = this.folder
      .addButton({
        title: 'Launch Rocket',
        // disabled: !this.isPositionsFilled(),
      })
      .on('click', (e) => {
        e.native.stopPropagation();

        this.onLaunchRocket();
      });
  }

  private toggleStartPositionClick = () => {
    this.startPositionSetIsActive = !this.startPositionSetIsActive;

    if (!this.startPositionSetIsActive) {
      this.setStartButton.title = this.startPositionLabels[0];
      this.setTargetButton.disabled = false;
    } else {
      this.setTargetButton.disabled = true;

      this.setStartButton.title = this.startPositionLabels[1];
    }
  };

  private toggleTargetPositionClick = () => {
    this.targetPositionSetIsActive = !this.targetPositionSetIsActive;

    if (!this.targetPositionSetIsActive) {
      this.setTargetButton.title = this.targetPositionLabels[0];
      this.setStartButton.disabled = false;
    } else {
      this.setStartButton.disabled = true;

      this.setTargetButton.title = this.targetPositionLabels[1];
    }
  };
}
