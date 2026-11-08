// Keep in sync with $mobile_breakpoint in OrbitalVelocity.module.scss
export const isMobileViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 640px)').matches;
