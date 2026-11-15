import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture | null>();

/**
 * Draw a texture once on a canvas and cache it. Returns null outside the
 * browser (e.g. in jest), so the meshes fall back to plain colors.
 */
export function getCanvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture | null {
  if (textureCache.has(key)) return textureCache.get(key)!;

  let texture: THREE.CanvasTexture | null = null;
  const canvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) {
    canvas.width = width;
    canvas.height = height;
    draw(ctx, width, height);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
  }
  textureCache.set(key, texture);
  return texture;
}
