import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Earth from './Earth';

function latLonToPosition(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

interface City {
  name: string;
  lat: number;
  lon: number;
}

const CITIES: City[] = [
  // North America
  { name: 'Washington D.C.', lat: 38.9, lon: -77.0 },
  { name: 'New York', lat: 40.7, lon: -74.0 },
  { name: 'Los Angeles', lat: 34.1, lon: -118.2 },
  { name: 'Chicago', lat: 41.9, lon: -87.6 },
  { name: 'Ottawa', lat: 45.4, lon: -75.7 },
  { name: 'Mexico City', lat: 19.4, lon: -99.1 },
  { name: 'Havana', lat: 23.1, lon: -82.4 },
  // South America
  { name: 'Brasília', lat: -15.8, lon: -47.9 },
  { name: 'Buenos Aires', lat: -34.6, lon: -58.4 },
  { name: 'Bogotá', lat: 4.7, lon: -74.1 },
  { name: 'Lima', lat: -12.0, lon: -77.0 },
  { name: 'Santiago', lat: -33.5, lon: -70.7 },
  // Europe
  { name: 'London', lat: 51.5, lon: -0.1 },
  { name: 'Paris', lat: 48.9, lon: 2.3 },
  { name: 'Berlin', lat: 52.5, lon: 13.4 },
  { name: 'Madrid', lat: 40.4, lon: -3.7 },
  { name: 'Rome', lat: 41.9, lon: 12.5 },
  { name: 'Moscow', lat: 55.8, lon: 37.6 },
  { name: 'Kyiv', lat: 50.5, lon: 30.5 },
  { name: 'Warsaw', lat: 52.2, lon: 21.0 },
  { name: 'Stockholm', lat: 59.3, lon: 18.1 },
  { name: 'Ankara', lat: 39.9, lon: 32.9 },
  { name: 'Amsterdam', lat: 52.4, lon: 4.9 },
  { name: 'Brussels', lat: 50.8, lon: 4.4 },
  { name: 'Vienna', lat: 48.2, lon: 16.4 },
  // Africa
  { name: 'Cairo', lat: 30.0, lon: 31.2 },
  { name: 'Nairobi', lat: -1.3, lon: 36.8 },
  { name: 'Lagos', lat: 6.5, lon: 3.4 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.0 },
  { name: 'Addis Ababa', lat: 9.0, lon: 38.7 },
  { name: 'Kinshasa', lat: -4.3, lon: 15.3 },
  { name: 'Algiers', lat: 36.7, lon: 3.1 },
  // Middle East
  { name: 'Tehran', lat: 35.7, lon: 51.4 },
  { name: 'Baghdad', lat: 33.3, lon: 44.4 },
  { name: 'Riyadh', lat: 24.7, lon: 46.7 },
  { name: 'Tel Aviv', lat: 32.1, lon: 34.8 },
  { name: 'Dubai', lat: 25.2, lon: 55.3 },
  { name: 'Doha', lat: 25.3, lon: 51.5 },
  { name: 'Amman', lat: 31.9, lon: 35.9 },
  { name: 'Damascus', lat: 33.5, lon: 36.3 },
  // South Asia
  { name: 'New Delhi', lat: 28.6, lon: 77.2 },
  { name: 'Islamabad', lat: 33.7, lon: 73.1 },
  { name: 'Karachi', lat: 24.9, lon: 67.0 },
  { name: 'Mumbai', lat: 19.1, lon: 72.9 },
  { name: 'Dhaka', lat: 23.8, lon: 90.4 },
  { name: 'Kabul', lat: 34.5, lon: 69.2 },
  { name: 'Colombo', lat: 6.9, lon: 79.9 },
  { name: 'Kathmandu', lat: 27.7, lon: 85.3 },
  // Central Asia
  { name: 'Tashkent', lat: 41.3, lon: 69.2 },
  { name: 'Astana', lat: 51.2, lon: 71.5 },
  // East / Southeast Asia
  { name: 'Beijing', lat: 39.9, lon: 116.4 },
  { name: 'Shanghai', lat: 31.2, lon: 121.5 },
  { name: 'Tokyo', lat: 35.7, lon: 139.7 },
  { name: 'Seoul', lat: 37.6, lon: 127.0 },
  { name: 'Pyongyang', lat: 39.0, lon: 125.8 },
  { name: 'Bangkok', lat: 13.8, lon: 100.5 },
  { name: 'Jakarta', lat: -6.2, lon: 106.8 },
  { name: 'Taipei', lat: 25.0, lon: 121.6 },
  { name: 'Manila', lat: 14.6, lon: 121.0 },
  { name: 'Hanoi', lat: 21.0, lon: 105.8 },
  { name: 'Singapore', lat: 1.3, lon: 103.8 },
  { name: 'Kuala Lumpur', lat: 3.1, lon: 101.7 },
  { name: 'Ulaanbaatar', lat: 47.9, lon: 106.9 },
  // Oceania
  { name: 'Canberra', lat: -35.3, lon: 149.1 },
  { name: 'Wellington', lat: -41.3, lon: 174.8 },
  { name: 'Sydney', lat: -33.9, lon: 151.2 },
];

export default class CityLabels {
  private objects: CSS2DObject[] = [];
  private surfaceNormals: THREE.Vector3[] = [];
  private _camPos = new THREE.Vector3();
  private _toCam = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    for (const city of CITIES) {
      const div = document.createElement('div');
      div.textContent = city.name;
      div.style.cssText = [
        'color:#fff',
        'font:bold 9px Arial,sans-serif',
        'text-shadow:0 0 3px #000,0 0 6px #000',
        'pointer-events:none',
        'white-space:nowrap',
        'padding:0 2px',
      ].join(';');

      const obj = new CSS2DObject(div);
      const pos = latLonToPosition(city.lat, city.lon, Earth.RADIUS * 1.012);
      obj.position.copy(pos);

      this.scene.add(obj);
      this.objects.push(obj);
      this.surfaceNormals.push(pos.clone().normalize());
    }
  }

  update(camera: THREE.Camera) {
    camera.getWorldPosition(this._camPos);
    for (let i = 0; i < this.objects.length; i++) {
      // Vector from city surface point toward the camera
      this._toCam.subVectors(this._camPos, this.objects[i].position).normalize();
      // 0.15 threshold keeps labels clearly on the front face; cities near
      // the limb (within ~81° of front) are hidden rather than hugging the edge
      this.objects[i].visible = this.surfaceNormals[i].dot(this._toCam) > 0.15;
    }
  }

  setVisible(visible: boolean) {
    for (const obj of this.objects) {
      obj.visible = visible;
    }
  }

  remove() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
    }
    this.objects = [];
    this.surfaceNormals = [];
  }
}
