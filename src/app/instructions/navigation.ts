import { useSimulatorStore } from '../store/useSimulatorStore';
import {
  INSTRUCTIONS_MENU,
  InstructionsPage,
  getInstructionsPageFromHash,
} from './pages';

export const openInstructionsPage = (
  page: InstructionsPage,
  mode: 'push' | 'replace',
  state: { fromMenu?: boolean } | null = null
) => {
  const url = `${window.location.pathname}${window.location.search}#${page}`;
  if (mode === 'push') {
    window.history.pushState(state, '', url);
  } else {
    window.history.replaceState(null, '', url);
  }
  useSimulatorStore.getState().setInstructionsPage(page);
};

export const closeInstructions = () => {
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  );
  useSimulatorStore.getState().setInstructionsPage(null);
};

export const backToInstructionsMenu = () => {
  // If we came from the menu, step back in history; otherwise (deep link) swap to it
  if (window.history.state?.fromMenu) {
    window.history.back();
  } else {
    openInstructionsPage(INSTRUCTIONS_MENU, 'replace');
  }
};

/** Keeps the modal in sync with the URL hash (back/forward, manual edits). */
export const subscribeInstructionsToHash = () => {
  const syncFromHash = () =>
    useSimulatorStore
      .getState()
      .setInstructionsPage(getInstructionsPageFromHash());
  window.addEventListener('popstate', syncFromHash);
  window.addEventListener('hashchange', syncFromHash);
  return () => {
    window.removeEventListener('popstate', syncFromHash);
    window.removeEventListener('hashchange', syncFromHash);
  };
};
