import { FolderApi, Pane } from 'tweakpane';

export interface CalculationRange {
  min: number;
  max: number;
}

export interface CalculationBounds {
  startInclineAfterDistance: CalculationRange; // km
  thrustInclineMaxDuration: CalculationRange; // seconds
  thrustInclineVelocityDeg: CalculationRange; // degrees per second
  fuelMass: CalculationRange; // kg
  exhaustVelocity: CalculationRange; // km/s
  massFlowRate: CalculationRange; // kg/s
}

export default class LauncherGui {
  private folder: FolderApi;

  selectedMissileId = 'us_minuteman3';
  selectedMissileLabel = '';

  minimizeFlightTime = true;
  increaseCalculationAccuracy = false;
  showCalculationPreview = false;

  startLongitude: number | string = 'N/A';
  startLatitude: number | string = 'N/A';

  rocketCount = 0;
  rocketSizeMultiplier = 1;

  calculationBounds: CalculationBounds = {
    startInclineAfterDistance: { min: 1, max: 4 },
    thrustInclineMaxDuration: { min: 10, max: 40 * 60 },
    thrustInclineVelocityDeg: { min: 0, max: 20 },
    fuelMass: { min: 300, max: 70000 },
    exhaustVelocity: { min: 1, max: 3 },
    massFlowRate: { min: 1, max: 100 },
  };

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Launcher',
      expanded: false,
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

    this.folder
      .addBinding(this, 'increaseCalculationAccuracy', {
        label: 'Increase Calculation Precision (slower)',
        view: 'checkbox',
        input: 'checkbox',
      })
      .on('change', (ev) => {
        this.increaseCalculationAccuracy = ev.value;
      });

    this.folder
      .addBinding(this, 'showCalculationPreview', {
        label: 'Animate Trajectory Calculating (slower)',
        view: 'checkbox',
        input: 'checkbox',
      })
      .on('change', (ev) => {
        this.showCalculationPreview = ev.value;
      });

    this.folder.addBinding(this, 'rocketCount', {
      label: 'Launched Missile Count',
      readonly: true,
      format: (v) => {
        return `${v.toFixed(0)} missiles`;
      },
    });

    const calculationFolder = this.folder.addFolder({
      title: 'Missile Calculation Preset',
      expanded: false,
    });

    calculationFolder.addBlade({
      view: 'notice',
      title: 'Info',
      variant: 'info',
      description:
        'These constraints define the range of values for the missile calculation parameters. Change them only if you know what you want to achieve.',
    });

    const bounds = this.calculationBounds;

    this.addRangeBindings(
      calculationFolder,
      bounds.startInclineAfterDistance,
      'Gravity Turn Start Altitude',
      'km',
      { min: 0, step: 0.1 }
    );
    this.addRangeBindings(
      calculationFolder,
      bounds.thrustInclineMaxDuration,
      'Gravity Turn Duration',
      's',
      { min: 0, step: 1 }
    );
    this.addRangeBindings(
      calculationFolder,
      bounds.thrustInclineVelocityDeg,
      'Gravity Turn Velocity',
      '°/s',
      { min: 0, max: 90, step: 0.1 }
    );
    this.addRangeBindings(
      calculationFolder,
      bounds.fuelMass,
      'Fuel Mass',
      'kg',
      { min: 0, step: 100 }
    );
    this.addRangeBindings(
      calculationFolder,
      bounds.exhaustVelocity,
      'Exhaust Velocity (vₑ)',
      'km/s',
      { min: 0, step: 0.1 }
    );
    this.addRangeBindings(
      calculationFolder,
      bounds.massFlowRate,
      'Mass Flow Rate (ṁ)',
      'kg/s',
      { min: 0, step: 1 }
    );
  }

  /** Adds min/max inputs for a search range, keeping min <= max. */
  private addRangeBindings(
    folder: FolderApi,
    range: CalculationRange,
    label: string,
    unit: string,
    params: { min?: number; max?: number; step?: number }
  ) {
    folder.addBlade({ view: 'title', title: label, unit });

    const minBinding = folder.addBinding(range, 'min', {
      label: 'min',
      ...params,
    });
    const maxBinding = folder.addBinding(range, 'max', {
      label: 'max',
      ...params,
    });

    minBinding.on('change', (ev) => {
      if (ev.value > range.max) {
        range.max = ev.value;
        maxBinding.refresh();
      }
    });
    maxBinding.on('change', (ev) => {
      if (ev.value < range.min) {
        range.min = ev.value;
        minBinding.refresh();
      }
    });
  }
}
