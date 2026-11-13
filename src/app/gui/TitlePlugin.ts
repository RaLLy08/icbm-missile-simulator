import {
    BladeApi,
    BladeController,
    ClassName,
    createPlugin,
    parseRecord,
    type BaseBladeParams,
    type Blade,
    type BladePlugin,
    type TpPluginBundle,
    type View,
    type ViewProps,
} from '@tweakpane/core';

/**
 * Small title box for tweakpane, used to head a group of bindings.
 *
 * Usage:
 *   pane.registerPlugin(TitlePluginBundle);
 *   folder.addBlade({ view: 'title', title: 'Fuel Mass', unit: 'kg' });
 */

const cn = ClassName('title'); // -> 'tp-titlev', 'tp-titlev_t', ...

interface TitleParams {
  title: string;
  unit?: string;
}

interface TitleBladeParams extends BaseBladeParams, TitleParams {
  view: 'title';
}

class TitleView implements View {
  public readonly element: HTMLElement;
  private readonly titleElement: HTMLElement;
  private readonly unitElement: HTMLElement;

  constructor(doc: Document, config: TitleParams & { viewProps: ViewProps }) {
    // Layout is set inline so the title and unit always sit on one row,
    // regardless of whether the bundle CSS gets injected or overridden.
    this.element = doc.createElement('div');
    this.element.classList.add(cn());
    Object.assign(this.element.style, {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '6px',
    });
    config.viewProps.bindClassModifiers(this.element);

    this.titleElement = doc.createElement('span');
    this.titleElement.classList.add(cn('t'));
    Object.assign(this.titleElement.style, {
      flex: '1 1 auto',
      minWidth: '0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    this.element.appendChild(this.titleElement);

    this.unitElement = doc.createElement('span');
    this.unitElement.classList.add(cn('u'));
    Object.assign(this.unitElement.style, {
      flex: '0 0 auto',
      whiteSpace: 'nowrap',
    });
    this.element.appendChild(this.unitElement);

    this.setTitle(config.title);
    this.setUnit(config.unit);
  }

  setTitle(title: string) {
    this.titleElement.textContent = title;
  }

  setUnit(unit: string | undefined) {
    this.unitElement.textContent = unit ?? '';
    this.unitElement.style.display = unit ? '' : 'none';
  }
}

class TitleController extends BladeController<TitleView> {
  constructor(
    doc: Document,
    config: TitleParams & { blade: Blade; viewProps: ViewProps }
  ) {
    super({
      blade: config.blade,
      view: new TitleView(doc, config),
      viewProps: config.viewProps,
    });
  }
}

export class TitleBladeApi extends BladeApi<TitleController> {
  set title(title: string) {
    this.controller.view.setTitle(title);
  }

  set unit(unit: string | undefined) {
    this.controller.view.setUnit(unit);
  }
}

const TitleBladePlugin: BladePlugin<TitleBladeParams> = createPlugin({
  id: 'title',
  type: 'blade',

  accept(params) {
    const result = parseRecord(params, (p) => ({
      view: p.required.constant('title'),
      title: p.required.string,
      unit: p.optional.string,
    }));
    return result ? { params: result } : null;
  },

  controller(args) {
    return new TitleController(args.document, {
      blade: args.blade,
      viewProps: args.viewProps,
      title: args.params.title,
      unit: args.params.unit,
    });
  },

  api(args) {
    if (!(args.controller instanceof TitleController)) {
      return null;
    }
    return new TitleBladeApi(args.controller);
  },
});

export const TitlePluginBundle: TpPluginBundle = {
  id: 'icbm-title',
  plugins: [TitleBladePlugin],
  css: `
    .tp-titlev {
      align-items: center;
      background-color: var(--cnt-bg);
      border-radius: var(--bld-br);
      box-sizing: border-box;
      display: flex;
      gap: 6px;
      height: var(--cnt-usz);
      margin: 4px 0 2px;
      padding: 0 var(--cnt-hp);
    }
    .tp-titlev_t {
      color: var(--cnt-fg);
      flex: 1;
      font-weight: bold;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tp-titlev_u {
      color: var(--lbl-fg);
      opacity: 0.7;
    }
  `,
};
