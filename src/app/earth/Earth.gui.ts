import { FolderApi, Pane } from 'tweakpane';
import Earth from './Earth';
import { atmosphereLayerKeys } from './earth.consts';

export default class EarthGui {
  private folder: FolderApi;
  private atmosphereLayersFolder: FolderApi;
  private atmosphereBordersFolder: FolderApi;

  showEarth = true;
  massKg = Earth.MASS;
  gravityConst = Earth.G;

  readonly atmosphereLayersStates = {
    [atmosphereLayerKeys.TROPOSPHERE]: false,
    [atmosphereLayerKeys.STRATOSPHERE]: false,
    [atmosphereLayerKeys.MESOSPHERE]: true,
    [atmosphereLayerKeys.THERMOSPHERE]: true,
    [atmosphereLayerKeys.EXOSPHERE]: true,
  };
  private readonly atmosphereLayersLabels = {
    [atmosphereLayerKeys.TROPOSPHERE]: 'Troposphere (0-10 km)',
    [atmosphereLayerKeys.STRATOSPHERE]: 'Stratosphere (10-50 km)',
    [atmosphereLayerKeys.MESOSPHERE]: 'Mesosphere (50-85 km)',
    [atmosphereLayerKeys.THERMOSPHERE]: 'Thermosphere (85-600 km)',
    [atmosphereLayerKeys.EXOSPHERE]: 'Exosphere (1000 km)',
  };

  readonly atmosphereBordersStates = {
    [atmosphereLayerKeys.TROPOSPHERE]: false,
    [atmosphereLayerKeys.STRATOSPHERE]: false,
    [atmosphereLayerKeys.MESOSPHERE]: false,
    [atmosphereLayerKeys.THERMOSPHERE]: false,
    [atmosphereLayerKeys.EXOSPHERE]: false,
  };
  private readonly atmosphereBordersLabels = {
    [atmosphereLayerKeys.TROPOSPHERE]: 'Troposphere (0-10 km)',
    [atmosphereLayerKeys.STRATOSPHERE]: 'Stratosphere (10-50 km)',
    [atmosphereLayerKeys.MESOSPHERE]: 'Mesosphere (50-85 km)',
    [atmosphereLayerKeys.THERMOSPHERE]: 'Thermosphere (85-600 km)',
    [atmosphereLayerKeys.EXOSPHERE]: 'Exosphere (1000 km)',
  };

  onAddAtmosphereLayerClicked: (layerKey: atmosphereLayerKeys) => void =
    () => {};
  onRemoveAtmosphereLayerClicked: (layerKey: atmosphereLayerKeys) => void =
    () => {};
  onAddAtmosphereBorderClicked: (layerKey: atmosphereLayerKeys) => void =
    () => {};
  onRemoveAtmosphereBorderClicked: (layerKey: atmosphereLayerKeys) => void =
    () => {};
  onShowEarthClicked: (show: boolean) => void = () => {};

  constructor(
    private readonly pane: Pane,
    private readonly earth: Earth
  ) {
    this.folder = pane.addFolder({
      title: 'Earth',
      expanded: true,
    });

    this.folder.addBinding(this, 'massKg', {
      label: 'Mass',
      readonly: true,
      format: (v) => v + ' kg',
    });

    this.folder.addBinding(this, 'gravityConst', {
      label: 'Grav. Const.',
      format: (v) => v + ' m³/(kg·s²)',
      readonly: true,
    });

    this.atmosphereLayersFolder = this.folder.addFolder({
      title: 'Atmosphere Layers',
      expanded: false,
    });

    Object.keys(this.atmosphereLayersStates).forEach(
      (key: atmosphereLayerKeys) => {
        this.atmosphereLayersFolder
          .addBinding(this.atmosphereLayersStates, key, {
            label: this.atmosphereLayersLabels[key],
            input: 'checkbox',
            view: 'checkbox',
          })
          .on('change', (ev) => {
            if (ev.value) {
              this.onAddAtmosphereLayerClicked(key);
            } else {
              this.onRemoveAtmosphereLayerClicked(key);
            }
          });
      }
    );

    this.atmosphereBordersFolder = this.folder.addFolder({
      title: 'Atmosphere Borders',
      expanded: false,
    });

    Object.keys(this.atmosphereBordersStates).forEach(
      (key: atmosphereLayerKeys) => {
        this.atmosphereBordersFolder
          .addBinding(this.atmosphereBordersStates, key, {
            label: this.atmosphereBordersLabels[key],
            input: 'checkbox',
            view: 'checkbox',
          })
          .on('change', (ev) => {
            if (ev.value) {
              this.onAddAtmosphereBorderClicked(key);
            } else {
              this.onRemoveAtmosphereBorderClicked(key);
            }
          });
      }
    );

    this.folder
      .addBinding(this, 'showEarth', {
        label: 'Show Earth',
        input: 'checkbox',
        view: 'checkbox',
      })
      .on('change', (ev) => {
        this.onShowEarthClicked(ev.value);
      });
  }

  update() {}
}
