export const atmosphereLayerKeys = {
  TROPOSPHERE: 'TROPOSPHERE',
  STRATOSPHERE: 'STRATOSPHERE',
  MESOSPHERE: 'MESOSPHERE',
  THERMOSPHERE: 'THERMOSPHERE',
  EXOSPHERE: 'EXOSPHERE',
} as const;
export type atmosphereLayerKeys = keyof typeof atmosphereLayerKeys;