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
 * Notice box for tweakpane: an optional title plus a wrapped description,
 * tinted by variant.
 *
 * Usage:
 *   pane.registerPlugin(NoticePluginBundle);
 *   folder.addBlade({
 *     view: 'notice',
 *     title: 'Info',
 *     variant: 'info',
 *     description: 'Some helpful text.',
 *   });
 */

const cn = ClassName('notice'); // -> 'tp-noticev', 'tp-noticev_t', ...

const VARIANTS = ['info', 'success', 'warning', 'error'] as const;
export type NoticeVariant = (typeof VARIANTS)[number];

const isVariant = (v: unknown): v is NoticeVariant =>
  typeof v === 'string' && (VARIANTS as readonly string[]).includes(v);

interface NoticeParams {
  title?: string;
  description: string;
  variant: NoticeVariant;
}

interface NoticeBladeParams extends BaseBladeParams {
  view: 'notice';
  title?: string;
  description: string;
  variant?: NoticeVariant;
}

class NoticeView implements View {
  public readonly element: HTMLElement;
  private readonly titleElement: HTMLElement;
  private readonly descriptionElement: HTMLElement;
  private variant: NoticeVariant;

  constructor(doc: Document, config: NoticeParams & { viewProps: ViewProps }) {
    this.element = doc.createElement('div');
    this.element.classList.add(cn());
    config.viewProps.bindClassModifiers(this.element);

    // Keep long text from widening the pane: the box contributes no
    // intrinsic width and just fills the width the other blades define.
    // Set inline so it applies even if a stale plugin stylesheet is cached
    // (tweakpane injects bundle CSS only once per document).
    Object.assign(this.element.style, {
      contain: 'inline-size',
      width: '0',
      minWidth: '100%',
      boxSizing: 'border-box',
    });

    this.titleElement = doc.createElement('div');
    this.titleElement.classList.add(cn('t'));
    this.element.appendChild(this.titleElement);

    this.descriptionElement = doc.createElement('div');
    this.descriptionElement.classList.add(cn('d'));
    this.element.appendChild(this.descriptionElement);

    this.variant = config.variant;
    this.element.classList.add(cn(undefined, this.variant));

    this.setTitle(config.title);
    this.setDescription(config.description);
  }

  setTitle(title: string | undefined) {
    this.titleElement.textContent = title ?? '';
    this.titleElement.style.display = title ? '' : 'none';
  }

  setDescription(description: string) {
    this.descriptionElement.textContent = description;
  }

  setVariant(variant: NoticeVariant) {
    this.element.classList.remove(cn(undefined, this.variant));
    this.variant = variant;
    this.element.classList.add(cn(undefined, this.variant));
  }
}

class NoticeController extends BladeController<NoticeView> {
  constructor(
    doc: Document,
    config: NoticeParams & { blade: Blade; viewProps: ViewProps }
  ) {
    super({
      blade: config.blade,
      view: new NoticeView(doc, config),
      viewProps: config.viewProps,
    });
  }
}

export class NoticeBladeApi extends BladeApi<NoticeController> {
  set title(title: string | undefined) {
    this.controller.view.setTitle(title);
  }

  set description(description: string) {
    this.controller.view.setDescription(description);
  }

  set variant(variant: NoticeVariant) {
    this.controller.view.setVariant(variant);
  }
}

const NoticeBladePlugin: BladePlugin<NoticeBladeParams> = createPlugin({
  id: 'notice',
  type: 'blade',

  accept(params) {
    const result = parseRecord(params, (p) => ({
      view: p.required.constant('notice'),
      description: p.required.string,
      title: p.optional.string,
      variant: p.optional.string,
    }));
    if (!result) {
      return null;
    }
    if (result.variant !== undefined && !isVariant(result.variant)) {
      return null;
    }
    return { params: result as NoticeBladeParams };
  },

  controller(args) {
    return new NoticeController(args.document, {
      blade: args.blade,
      viewProps: args.viewProps,
      title: args.params.title,
      description: args.params.description,
      variant: args.params.variant ?? 'info',
    });
  },

  api(args) {
    if (!(args.controller instanceof NoticeController)) {
      return null;
    }
    return new NoticeBladeApi(args.controller);
  },
});

export const NoticePluginBundle: TpPluginBundle = {
  id: 'icbm-notice',
  plugins: [NoticeBladePlugin],
  css: `
    .tp-noticev {
      --notice-accent: #4aa3ff;
      background-color: color-mix(in srgb, var(--notice-accent) 12%, transparent);
      border-radius: var(--bld-br);
      box-sizing: border-box;
      margin: 4px 0;
      padding: 6px var(--cnt-hp);
      /* Don't contribute to the pane's intrinsic width: take the width the
         other blades define and wrap the text inside it. */
      contain: inline-size;
      width: 0;
      min-width: 100%;
    }
    .tp-noticev-success { --notice-accent: #3ecf8e; }
    .tp-noticev-warning { --notice-accent: #f5a524; }
    .tp-noticev-error   { --notice-accent: #f25f5c; }
    .tp-noticev_t {
      color: var(--notice-accent);
      font-weight: bold;
      margin-bottom: 2px;
    }
    .tp-noticev_d {
      color: var(--cnt-fg);
      line-height: 1.4;
      opacity: 0.85;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  `,
};
