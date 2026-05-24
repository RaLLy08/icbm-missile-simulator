export interface DefenseSpec {
  id: string;
  name: string;
  country: string;
  radarRange: number;
  interceptorExhaustVelocity: number;
  interceptorMassFlowRate: number;
  interceptorFuelMass: number;
  interceptorPayloadMass: number;
  maxAmmo: number;
  color: number;
}

export const DEFENSE_SYSTEMS: DefenseSpec[] = [
  {
    id: 's400',
    name: 'S-400 Triumf',
    country: 'Russia',
    radarRange: 600,
    interceptorExhaustVelocity: 4.0,
    interceptorMassFlowRate: 120,
    interceptorFuelMass: 3000,
    interceptorPayloadMass: 200,
    maxAmmo: 12,
    color: 0xff4444,
  },
  {
    id: 's500',
    name: 'S-500 Prometheus',
    country: 'Russia',
    radarRange: 800,
    interceptorExhaustVelocity: 5.0,
    interceptorMassFlowRate: 150,
    interceptorFuelMass: 4000,
    interceptorPayloadMass: 250,
    maxAmmo: 10,
    color: 0xff6600,
  },
  {
    id: 'thaad',
    name: 'THAAD',
    country: 'US',
    radarRange: 350,
    interceptorExhaustVelocity: 4.5,
    interceptorMassFlowRate: 100,
    interceptorFuelMass: 2500,
    interceptorPayloadMass: 150,
    maxAmmo: 8,
    color: 0x44aaff,
  },
  {
    id: 'patriot',
    name: 'Patriot PAC-3',
    country: 'US',
    radarRange: 250,
    interceptorExhaustVelocity: 3.5,
    interceptorMassFlowRate: 80,
    interceptorFuelMass: 1800,
    interceptorPayloadMass: 150,
    maxAmmo: 16,
    color: 0x44ff44,
  },
  {
    id: 'aegis',
    name: 'Aegis SM-3',
    country: 'US',
    radarRange: 500,
    interceptorExhaustVelocity: 5.5,
    interceptorMassFlowRate: 180,
    interceptorFuelMass: 5000,
    interceptorPayloadMass: 300,
    maxAmmo: 6,
    color: 0xffff44,
  },
  {
    id: 'irondome',
    name: 'Iron Dome',
    country: 'Israel',
    radarRange: 100,
    interceptorExhaustVelocity: 2.5,
    interceptorMassFlowRate: 40,
    interceptorFuelMass: 500,
    interceptorPayloadMass: 50,
    maxAmmo: 20,
    color: 0xff88ff,
  },
];

export function getDefenseSpec(id: string): DefenseSpec | undefined {
  return DEFENSE_SYSTEMS.find((d) => d.id === id);
}

export function getDefenseOptions() {
  return DEFENSE_SYSTEMS.map((d) => ({
    text: `${d.country} - ${d.name}`,
    value: d.id,
  }));
}
