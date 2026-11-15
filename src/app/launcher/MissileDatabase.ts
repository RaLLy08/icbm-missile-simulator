interface MinMax {
  min: number;
  max: number;
}

/** Search range of one engine stage. Stages burn in ascending `stage` order. */
export interface MissileStageSpec {
  stage: number;
  exhaustVelocity: MinMax; // km/s
  massFlowRate: MinMax; // kg/s
  fuelMass: MinMax; // kg
}

export interface MissileSpec {
  id: string;
  name: string;
  country: string;
  category: MissileCategories;
  height: number; // m
  payloadMass: number; // kg

  startInclineAfterAltitude: MinMax; // km
  thrustInclineMaxDuration: MinMax; // seconds
  thrustInclineVelocityDeg: MinMax; // degrees per second
  stages: MissileStageSpec[];
}

const MissileCategories = {
  ICBM: 'ICBM',
  Hypersonic: 'Hypersonic',
  IRBM: 'IRBM',
  MRBM: 'MRBM',
  SRBM: 'SRBM',
  CruiseMissile: 'Cruise Missile',
  AntiShip: 'Anti-Ship',
} as const;

type MissileCategories =
  (typeof MissileCategories)[keyof typeof MissileCategories];

export const MISSILES: MissileSpec[] = [
  // ─── US ───
  {
    id: 'us_minuteman3',
    name: 'LGM-30 Minuteman III',
    country: 'US',
    category: MissileCategories.ICBM,
    height: 18.25,
    payloadMass: 1150,
    startInclineAfterAltitude: { min: 1, max: 4 },
    thrustInclineMaxDuration: { min: 10, max: 40 * 60 },
    thrustInclineVelocityDeg: { min: 0, max: 20 },
    stages: [
      // M55A1 — nominal: vₑ 2.57 km/s, ṁ 346.4 kg/s, fuel 20785 kg (~60 s burn)
      {
        stage: 1,
        exhaustVelocity: { min: 2.45, max: 2.7 },
        massFlowRate: { min: 310, max: 380 },
        fuelMass: { min: 19750, max: 21800 },
      },
      // SR19 — nominal: vₑ 2.82 km/s, ṁ 94.5 kg/s, fuel 6237 kg (~66 s burn)
      {
        stage: 2,
        exhaustVelocity: { min: 2.68, max: 2.96 },
        massFlowRate: { min: 85, max: 104 },
        fuelMass: { min: 5900, max: 6550 },
      },
      // SR73 — nominal: vₑ 2.79 km/s, ṁ 52.5 kg/s, fuel 3200 kg (~61 s burn)
      {
        stage: 3,
        exhaustVelocity: { min: 2.65, max: 2.93 },
        massFlowRate: { min: 47, max: 58 },
        fuelMass: { min: 3040, max: 3360 },
      },
    ],
  },
  {
    id: 'lgm-30g-minuteman-3',
    name: 'LGM-30G Minuteman III',
    country: 'USA',
    category: 'ICBM' as MissileCategories,
    height: 18.25,
    payloadMass: 1150,
    startInclineAfterAltitude: { min: 0.15, max: 0.4 },
    thrustInclineMaxDuration: { min: 35, max: 55 },
    thrustInclineVelocityDeg: { min: 0.8, max: 1.4 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.32, max: 2.57 },
        massFlowRate: { min: 335, max: 360 },
        fuelMass: { min: 20500, max: 21000 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.75, max: 2.85 },
        massFlowRate: { min: 90, max: 100 },
        fuelMass: { min: 6150, max: 6350 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.72, max: 2.82 },
        massFlowRate: { min: 48, max: 56 },
        fuelMass: { min: 3100, max: 3300 },
      },
    ],
  },
  {
    id: 'lgm-118a-peacekeeper',
    name: 'LGM-118A Peacekeeper',
    country: 'USA',
    category: 'ICBM' as MissileCategories,
    height: 21.8,
    payloadMass: 3950,
    startInclineAfterAltitude: { min: 0.2, max: 0.45 },
    thrustInclineMaxDuration: { min: 35, max: 50 },
    thrustInclineVelocityDeg: { min: 0.85, max: 1.45 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.42, max: 2.65 },
        massFlowRate: { min: 790, max: 840 },
        fuelMass: { min: 44200, max: 45400 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.72, max: 2.82 },
        massFlowRate: { min: 375, max: 405 },
        fuelMass: { min: 22100, max: 22900 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.8, max: 2.9 },
        massFlowRate: { min: 110, max: 122 },
        fuelMass: { min: 7300, max: 7650 },
      },
    ],
  },
  {
    id: 'ugm-133a-trident-2-d5',
    name: 'UGM-133A Trident II D5',
    country: 'USA',
    category: 'SLBM' as MissileCategories,
    height: 13.58,
    payloadMass: 2700,
    startInclineAfterAltitude: { min: 0.1, max: 0.35 },
    thrustInclineMaxDuration: { min: 30, max: 50 },
    thrustInclineVelocityDeg: { min: 0.9, max: 1.6 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.48, max: 2.7 },
        massFlowRate: { min: 515, max: 545 },
        fuelMass: { min: 34000, max: 34900 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.76, max: 2.86 },
        massFlowRate: { min: 205, max: 225 },
        fuelMass: { min: 12650, max: 13150 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.82, max: 2.92 },
        massFlowRate: { min: 80, max: 90 },
        fuelMass: { min: 3750, max: 3950 },
      },
    ],
  },
  {
    id: 'rt-2pm2-topol-m',
    name: 'RT-2PM2 Topol-M',
    country: 'Russia',
    category: 'ICBM' as MissileCategories,
    height: 22.7,
    payloadMass: 1200,
    startInclineAfterAltitude: { min: 0.15, max: 0.4 },
    thrustInclineMaxDuration: { min: 30, max: 50 },
    thrustInclineVelocityDeg: { min: 0.9, max: 1.55 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.38, max: 2.62 },
        massFlowRate: { min: 455, max: 495 },
        fuelMass: { min: 26800, max: 27800 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.7, max: 2.82 },
        massFlowRate: { min: 155, max: 175 },
        fuelMass: { min: 9200, max: 9800 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.74, max: 2.85 },
        massFlowRate: { min: 65, max: 78 },
        fuelMass: { min: 3600, max: 3900 },
      },
    ],
  },
  {
    id: 'r-36m2-voevoda',
    name: 'R-36M2 Voevoda (SS-18)',
    country: 'Russia',
    category: 'ICBM' as MissileCategories,
    height: 34.3,
    payloadMass: 8800,
    startInclineAfterAltitude: { min: 0.25, max: 0.6 },
    thrustInclineMaxDuration: { min: 45, max: 75 },
    thrustInclineVelocityDeg: { min: 0.6, max: 1.15 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.75, max: 3.02 },
        massFlowRate: { min: 1120, max: 1200 },
        fuelMass: { min: 149000, max: 152000 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 3.15, max: 3.26 },
        massFlowRate: { min: 210, max: 235 },
        fuelMass: { min: 37000, max: 38200 },
      },
    ],
  },
  {
    id: 'df-41',
    name: 'DF-41',
    country: 'China',
    category: 'ICBM' as MissileCategories,
    height: 22.0,
    payloadMass: 2500,
    startInclineAfterAltitude: { min: 0.15, max: 0.45 },
    thrustInclineMaxDuration: { min: 35, max: 55 },
    thrustInclineVelocityDeg: { min: 0.85, max: 1.45 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.4, max: 2.64 },
        massFlowRate: { min: 710, max: 760 },
        fuelMass: { min: 43500, max: 45000 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.72, max: 2.84 },
        massFlowRate: { min: 270, max: 295 },
        fuelMass: { min: 16800, max: 17600 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.76, max: 2.88 },
        massFlowRate: { min: 115, max: 130 },
        fuelMass: { min: 6800, max: 7300 },
      },
    ],
  },
  {
    id: 'agni-5',
    name: 'Agni-V',
    country: 'India',
    category: 'ICBM' as MissileCategories,
    height: 17.5,
    payloadMass: 1500,
    startInclineAfterAltitude: { min: 0.15, max: 0.4 },
    thrustInclineMaxDuration: { min: 35, max: 55 },
    thrustInclineVelocityDeg: { min: 0.85, max: 1.45 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.35, max: 2.58 },
        massFlowRate: { min: 420, max: 460 },
        fuelMass: { min: 27000, max: 28200 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.68, max: 2.8 },
        massFlowRate: { min: 165, max: 185 },
        fuelMass: { min: 10200, max: 10800 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.72, max: 2.84 },
        massFlowRate: { min: 60, max: 75 },
        fuelMass: { min: 3600, max: 4000 },
      },
    ],
  },
  {
    id: 'hwasong-18',
    name: 'Hwasong-18',
    country: 'North Korea',
    category: 'ICBM' as MissileCategories,
    height: 25.0,
    payloadMass: 1250,
    startInclineAfterAltitude: { min: 0.2, max: 0.5 },
    thrustInclineMaxDuration: { min: 35, max: 60 },
    thrustInclineVelocityDeg: { min: 0.8, max: 1.4 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.34, max: 2.56 },
        massFlowRate: { min: 520, max: 570 },
        fuelMass: { min: 33500, max: 35000 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.66, max: 2.78 },
        massFlowRate: { min: 190, max: 215 },
        fuelMass: { min: 11800, max: 12500 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.7, max: 2.82 },
        massFlowRate: { min: 70, max: 85 },
        fuelMass: { min: 4100, max: 4500 },
      },
    ],
  },
  {
    id: 'hwasong-17',
    name: 'Hwasong-17 (Liquid)',
    country: 'North Korea',
    category: 'ICBM' as MissileCategories,
    height: 26.0,
    payloadMass: 2500,
    startInclineAfterAltitude: { min: 0.25, max: 0.6 },
    thrustInclineMaxDuration: { min: 45, max: 75 },
    thrustInclineVelocityDeg: { min: 0.65, max: 1.2 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.65, max: 2.95 },
        massFlowRate: { min: 560, max: 620 },
        fuelMass: { min: 72000, max: 76000 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.98, max: 3.15 },
        massFlowRate: { min: 130, max: 155 },
        fuelMass: { min: 18500, max: 20500 },
      },
    ],
  },
  {
    id: 'jericho-3',
    name: 'Jericho III',
    country: 'Israel',
    category: 'ICBM' as MissileCategories,
    height: 15.5,
    payloadMass: 1150,
    startInclineAfterAltitude: { min: 0.15, max: 0.35 },
    thrustInclineMaxDuration: { min: 30, max: 50 },
    thrustInclineVelocityDeg: { min: 0.9, max: 1.55 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.38, max: 2.6 },
        massFlowRate: { min: 280, max: 315 },
        fuelMass: { min: 16200, max: 17200 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.7, max: 2.82 },
        massFlowRate: { min: 95, max: 115 },
        fuelMass: { min: 5400, max: 5900 },
      },
      {
        stage: 3,
        exhaustVelocity: { min: 2.75, max: 2.86 },
        massFlowRate: { min: 40, max: 52 },
        fuelMass: { min: 2100, max: 2400 },
      },
    ],
  },
  {
    id: 'shaheen-3',
    name: 'Shaheen-III',
    country: 'Pakistan',
    category: 'MRBM' as MissileCategories,
    height: 19.3,
    payloadMass: 1000,
    startInclineAfterAltitude: { min: 0.1, max: 0.3 },
    thrustInclineMaxDuration: { min: 25, max: 45 },
    thrustInclineVelocityDeg: { min: 1.0, max: 1.75 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.32, max: 2.52 },
        massFlowRate: { min: 310, max: 350 },
        fuelMass: { min: 15500, max: 16800 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.62, max: 2.75 },
        massFlowRate: { min: 110, max: 130 },
        fuelMass: { min: 5200, max: 5800 },
      },
    ],
  },
  {
    id: 'sejjil-2',
    name: 'Sejjil-2',
    country: 'Iran',
    category: 'MRBM' as MissileCategories,
    height: 18.2,
    payloadMass: 750,
    startInclineAfterAltitude: { min: 0.1, max: 0.3 },
    thrustInclineMaxDuration: { min: 25, max: 45 },
    thrustInclineVelocityDeg: { min: 1.05, max: 1.8 },
    stages: [
      {
        stage: 1,
        exhaustVelocity: { min: 2.3, max: 2.5 },
        massFlowRate: { min: 270, max: 305 },
        fuelMass: { min: 13500, max: 14500 },
      },
      {
        stage: 2,
        exhaustVelocity: { min: 2.6, max: 2.72 },
        massFlowRate: { min: 95, max: 115 },
        fuelMass: { min: 4500, max: 5000 },
      },
    ],
  },
];

export const getMissileById = (id: string): MissileSpec | undefined =>
  MISSILES.find((m) => m.id === id);
