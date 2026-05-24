import { FolderApi, Pane } from 'tweakpane';
import { getDefenseOptions, getDefenseSpec, DEFENSE_SYSTEMS } from './DefenseDatabase';

export default class DefenseGui {
  private folder: FolderApi;
  selectedSystemId = DEFENSE_SYSTEMS[0].id;
  isPlacing = false;
  statusText = 'Place a defense site on Earth';
  sitesCount = 0;

  onPlaceDefenseClicked: (systemId: string) => void = () => {};
  onRemoveLastSiteClicked: () => void = () => {};
  onClearAllSitesClicked: () => void = () => {};

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Missile Defense',
      expanded: true,
    });

    this.folder
      .addBinding(this, 'selectedSystemId', {
        label: 'Defense System',
        view: 'list',
        options: getDefenseOptions(),
      })
      .on('change', (ev) => {
        this.selectedSystemId = ev.value;
      });

    this.folder
      .addButton({ title: 'Place Defense Site' })
      .on('click', () => {
        this.isPlacing = true;
        this.statusText = 'Click on Earth to place the defense system';
        this.folder.refresh();
        this.onPlaceDefenseClicked(this.selectedSystemId);
      });

    this.folder
      .addButton({ title: 'Remove Last Site' })
      .on('click', () => {
        this.onRemoveLastSiteClicked();
      });

    this.folder
      .addButton({ title: 'Clear All Sites' })
      .on('click', () => {
        this.onClearAllSitesClicked();
      });

    this.folder.addBinding(this, 'statusText', {
      label: 'Status',
      readonly: true,
    });
  }

  refresh() {
    this.folder.refresh();
  }
}
