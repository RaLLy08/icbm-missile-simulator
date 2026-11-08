import * as THREE from 'three';

const createRenderer = () => {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio);
  return renderer;
};

export const createFullScreenRenderer = (container: HTMLElement) => {
  const renderer = createRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  return renderer;
};

export const createMiniWindowRenderer = (
  container: HTMLElement,
  isMobile: boolean
) => {
  const renderer = createRenderer();
  // must match .miniWindowContainer size in the stylesheet
  const miniSize = isMobile ? 180 : 300;
  container.style.width = `${miniSize}px`;
  container.style.height = `${miniSize}px`;

  // Don't measure the element: on phones the minimap starts folded
  // (display: none), which would report 0x0 and leave the canvas empty.
  renderer.setSize(miniSize, miniSize);
  container.appendChild(renderer.domElement);
  return renderer;
};
