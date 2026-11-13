import { FolderApi, Pane } from 'tweakpane';
import { MISSILES, getMissileById, type MissileSpec } from './MissileDatabase';

type BindingApi = ReturnType<FolderApi['addBinding']>;

const CUSTOM_MISSILE_ID = 'custom';

export interface CalculationRange {
  min: number;
  max: number;
}

export interface StageCalculationBounds {
  stage: number;
  exhaustVelocity: CalculationRange; // km/s
  massFlowRate: CalculationRange; // kg/s
  fuelMass: CalculationRange; // kg
}

export interface CalculationBounds {
  startInclineAfterDistance: CalculationRange; // km
  thrustInclineMaxDuration: CalculationRange; // seconds
  thrustInclineVelocityDeg: CalculationRange; // degrees per second
  /** Burnt in ascending `stage` order */
  stages: StageCalculationBounds[];
}

const cloneStageBounds = (
  s: StageCalculationBounds,
  stage: number
): StageCalculationBounds => ({
  stage,
  exhaustVelocity: { ...s.exhaustVelocity },
  massFlowRate: { ...s.massFlowRate },
  fuelMass: { ...s.fuelMass },
});

export default class LauncherGui {
  private folder: FolderApi;

  /** `CUSTOM_MISSILE_ID` keeps the manually edited bounds */
  selectedMissileId = CUSTOM_MISSILE_ID;
  selectedMissileLabel = '';

  minimizeFlightTime = true;
  increaseCalculationAccuracy = false;
  showCalculationPreview = false;

  startLongitude: number | string = 'N/A';
  startLatitude: number | string = 'N/A';

  rocketCount = 0;
  rocketSizeMultiplier = 1;

  /** Payload of the selected missile, kg */
  payloadMass = 800;

  /** Real length of the selected missile, m. Null until a preset is picked. */
  missileHeight: number | null = null;

  calculationBounds: CalculationBounds = {
    startInclineAfterDistance: { min: 1, max: 4 },
    thrustInclineMaxDuration: { min: 10, max: 40 * 60 },
    thrustInclineVelocityDeg: { min: 0, max: 20 },
    stages: [
      {
        stage: 0,
        exhaustVelocity: { min: 2, max: 4 },
        massFlowRate: { min: 100, max: 400 },
        fuelMass: { min: 1000, max: 30000 },
      },
      {
        stage: 1,
        exhaustVelocity: { min: 2, max: 4 },
        massFlowRate: { min: 100, max: 200 },
        fuelMass: { min: 1000, max: 4000 },
      },
    ],
  };

  private stagesFolder: FolderApi | null = null;
  private stageFolders: FolderApi[] = [];
  /** min/max bindings of the guidance ranges, refreshed on preset change */
  private guidanceBindings: BindingApi[] = [];

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Launcher',
      expanded: false,
    });

    const initialMissile = getMissileById(this.selectedMissileId);
    if (initialMissile) this.applyMissilePreset(initialMissile);

    this.folder
      .addBinding(this, 'selectedMissileId', {
        label: 'Missile',
        options: MISSILES.reduce<Record<string, string>>(
          (acc, m) => {
            acc[`${m.name} (${m.country})`] = m.id;
            return acc;
          },
          { Custom: CUSTOM_MISSILE_ID }
        ),
      })
      .on('change', (ev) => {
        // Custom keeps the current bounds as they are
        const missile = getMissileById(ev.value);
        if (!missile) return;
        this.applyMissilePreset(missile);
        this.guidanceBindings.forEach((b) => b.refresh());
        this.renderStages();
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

    this.guidanceBindings = [
      ...this.addRangeBindings(
        calculationFolder,
        bounds.startInclineAfterDistance,
        'Gravity Turn Start Altitude',
        'km',
        { min: 0, step: 0.1 }
      ),
      ...this.addRangeBindings(
        calculationFolder,
        bounds.thrustInclineMaxDuration,
        'Gravity Turn Duration',
        's',
        { min: 0, step: 1 }
      ),
      ...this.addRangeBindings(
        calculationFolder,
        bounds.thrustInclineVelocityDeg,
        'Gravity Turn Velocity',
        '°/s',
        { min: 0, max: 90, step: 0.1 }
      ),
    ];

    const stagesFolder = calculationFolder.addFolder({
      title: 'Stages',
      expanded: true,
    });
    this.stagesFolder = stagesFolder;

    stagesFolder.addButton({ title: 'Add Stage' }).on('click', () => {
      const stages = this.calculationBounds.stages;
      const last = stages[stages.length - 1];
      stages.push(cloneStageBounds(last, last.stage + 1));
      this.renderStages();
    });

    stagesFolder.addButton({ title: 'Remove Last Stage' }).on('click', () => {
      if (this.calculationBounds.stages.length <= 1) return;
      this.calculationBounds.stages.pop();
      this.renderStages();
    });

    this.renderStages();
  }

  /** Rebuilds one folder of search ranges per stage. */
  private renderStages() {
    const stagesFolder = this.stagesFolder;
    if (!stagesFolder) return;

    this.stageFolders.forEach((folder) => folder.dispose());

    this.stageFolders = this.calculationBounds.stages.map((stage, i) => {
      // Folders are appended after the add/remove buttons
      const folder = stagesFolder.addFolder({
        title: `Stage ${i + 1}`,
        expanded: true,
      });

      this.addRangeBindings(
        folder,
        stage.exhaustVelocity,
        'Exhaust Velocity (vₑ)',
        'km/s',
        { min: 0, step: 0.1 }
      );
      this.addRangeBindings(
        folder,
        stage.massFlowRate,
        'Mass Flow Rate (ṁ)',
        'kg/s',
        { min: 0.1, step: 1 }
      );
      this.addRangeBindings(folder, stage.fuelMass, 'Fuel Mass', 'kg', {
        min: 0,
        step: 100,
      });

      return folder;
    });
  }

  /**
   * Copies a missile's ranges into `calculationBounds`. Guidance ranges are
   * updated in place so their existing bindings stay attached.
   */
  private applyMissilePreset(missile: MissileSpec) {
    const bounds = this.calculationBounds;

    Object.assign(
      bounds.startInclineAfterDistance,
      missile.startInclineAfterDistance
    );
    Object.assign(
      bounds.thrustInclineMaxDuration,
      missile.thrustInclineMaxDuration
    );
    Object.assign(
      bounds.thrustInclineVelocityDeg,
      missile.thrustInclineVelocityDeg
    );
    bounds.stages = missile.stages.map((s) => cloneStageBounds(s, s.stage));

    this.payloadMass = missile.payloadMass;
    this.missileHeight = missile.height;
    this.selectedMissileLabel = missile.name;
  }

  /** Adds min/max inputs for a search range, keeping min <= max. */
  private addRangeBindings(
    folder: FolderApi,
    range: CalculationRange,
    label: string,
    unit: string,
    params: { min?: number; max?: number; step?: number }
  ): BindingApi[] {
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

    return [minBinding, maxBinding];
  }
}
