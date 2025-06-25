import { FolderApi, Pane } from 'tweakpane';
import Earth from './Earth';
import EarthView from './EarthView';
import { atmosphereLayerKeys } from './earth.consts';

export default class EarthGui {
  private folder: FolderApi;
  private atmosphereLayersFolder: FolderApi;
  private atmosphereBordersFolder: FolderApi;

  showEarth = true;
  massKg = Earth.MASS;
  gravityConst = Earth.G;

  private readonly atmosphereLayersStates = {
    [atmosphereLayerKeys.TROPOSPHERE]: false,
    [atmosphereLayerKeys.STRATOSPHERE]: false,
    [atmosphereLayerKeys.MESOSPHERE]: false,
    [atmosphereLayerKeys.THERMOSPHERE]: false,
    [atmosphereLayerKeys.EXOSPHERE]: false,
  };
  private readonly atmosphereLayersLabels = {
    [atmosphereLayerKeys.TROPOSPHERE]: 'Troposphere',
    [atmosphereLayerKeys.STRATOSPHERE]: 'Stratosphere',
    [atmosphereLayerKeys.MESOSPHERE]: 'Mesosphere',
    [atmosphereLayerKeys.THERMOSPHERE]: 'Thermosphere',
    [atmosphereLayerKeys.EXOSPHERE]: 'Exosphere',
  };

  private readonly atmosphereBordersStates = {
    [atmosphereLayerKeys.TROPOSPHERE]: false,
    [atmosphereLayerKeys.STRATOSPHERE]: false,
    [atmosphereLayerKeys.MESOSPHERE]: false,
    [atmosphereLayerKeys.THERMOSPHERE]: false,
    [atmosphereLayerKeys.EXOSPHERE]: false,
  };
  private readonly atmosphereBordersLabels = {
    [atmosphereLayerKeys.TROPOSPHERE]: 'Troposphere',
    [atmosphereLayerKeys.STRATOSPHERE]: 'Stratosphere',
    [atmosphereLayerKeys.MESOSPHERE]: 'Mesosphere',
    [atmosphereLayerKeys.THERMOSPHERE]: 'Thermosphere',
    [atmosphereLayerKeys.EXOSPHERE]: 'Exosphere',
  };

  constructor(
    private readonly pane: Pane,
    private readonly earth: Earth,
    private readonly earthView: EarthView
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

    this.earthView.atmosphereLayers.forEach((layer, key) => {
      this.atmosphereLayersFolder
        .addBinding(this.atmosphereLayersStates, key, {
          label: this.atmosphereLayersLabels[key],
          input: 'checkbox',
          view: 'checkbox',
        })
        .on('change', (ev) => {
          if (ev.value) {
            this.earthView.renderAtmosphereLayer(key);
          } else {
            this.earthView.removeAtmosphereLayer(key);
          }
        });
    });

    this.atmosphereBordersFolder = this.folder.addFolder({
      title: 'Atmosphere Borders',
      expanded: true,
    });

    this.earthView.atmostphereBorders.forEach((border, key) => {
      this.atmosphereBordersFolder
        .addBinding(this.atmosphereBordersStates, key, {
          label: this.atmosphereBordersLabels[key],
          input: 'checkbox',
          view: 'checkbox',
        })
        .on('change', (ev) => {
          if (ev.value) {
            this.earthView.renderAtmosphereBorder(key);
          } else {
            this.earthView.removeAtmosphereBorder(key);
          }
        });
    });

    this.folder.addBinding(this, 'showEarth', {
      label: 'Show Earth',
      input: 'checkbox',
      view: 'checkbox',
    }).on('change', (ev) => {
      this.earthView.setVisibility(ev.value);
    });
    
  }

  update() {}
}
