import type { FolderApi, Pane } from 'tweakpane';

const CONFIRM_TIMEOUT_MS = 3000;

type ConfirmButtonOptions = {
  title: string;
  /** Title shown while waiting for the confirming second click. */
  confirmTitle: string;
  onConfirm: () => void;
  /** Position within the pane/folder (defaults to the end). */
  index?: number;
};

/**
 * Tweakpane button for destructive actions: the first click arms it, a
 * second click within a few seconds runs `onConfirm`.
 */
export const addConfirmButton = (
  container: Pane | FolderApi,
  { title, confirmTitle, onConfirm, index }: ConfirmButtonOptions
) => {
  const button = container.addButton({ title, index });
  let disarmTimeout: ReturnType<typeof setTimeout> | null = null;

  const disarm = () => {
    if (disarmTimeout) clearTimeout(disarmTimeout);
    disarmTimeout = null;
    button.title = title;
  };

  button.on('click', () => {
    if (!disarmTimeout) {
      button.title = confirmTitle;
      disarmTimeout = setTimeout(disarm, CONFIRM_TIMEOUT_MS);
      return;
    }
    disarm();
    onConfirm();
  });

  return button;
};
