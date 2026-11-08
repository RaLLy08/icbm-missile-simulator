import * as THREE from 'three';

export const createScene = () => {
  const scene = new THREE.Scene();

  // Strong ambient light for even illumination across the entire Earth
  scene.add(new THREE.AmbientLight(0xffffff, 2.5));

  // Subtle directional light for minimal definition without harsh shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight.position.set(5, 3, 5).normalize();
  directionalLight.castShadow = false;
  scene.add(directionalLight);

  // Hemisphere light for global illumination (sky and ground bounce light)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8));

  return scene;
};
