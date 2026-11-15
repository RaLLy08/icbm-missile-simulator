export const INSTRUCTIONS_MENU = 'help';

export const INSTRUCTIONS_PAGES = [
  {
    id: 'how-to-launch',
    label: 'How to Launch a Missile?',
    description: 'Step-by-step guide to setting up and firing launches',
  },
  {
    id: 'how-it-works',
    label: 'How does it work? (Briefly)',
    description: 'The physics and the trajectory search behind the simulator',
  },
  {
    id: 'documentation',
    label: 'Full Documentation',
    description: 'Units, parameters and equations of the physics model',
  },
  {
    id: 'support',
    label: 'How to support me? 😊',
    description: '',
  },
] as const;

export type InstructionsPage =
  | typeof INSTRUCTIONS_MENU
  | (typeof INSTRUCTIONS_PAGES)[number]['id'];

export const getInstructionsPageFromHash = (): InstructionsPage | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === INSTRUCTIONS_MENU) return INSTRUCTIONS_MENU;
  return INSTRUCTIONS_PAGES.some((p) => p.id === hash)
    ? (hash as InstructionsPage)
    : null;
};
