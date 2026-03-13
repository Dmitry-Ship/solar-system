import type {
  DriftingBodyDefinition,
  VoyagerDefinition
} from "../../types/solar-system";

export interface SceneBodyCatalog {
  VOYAGERS: VoyagerDefinition[];
  DRIFTING_BODIES: DriftingBodyDefinition[];
}

const VOYAGERS: VoyagerDefinition[] = [
  {
    name: "Voyager 1",
    color: "#ffb36a",
    position: { x: -31.907038, y: -135.14229, z: 97.779917 },
    minPixelRadius: 1.45,
    radiusKm: 0.005
  },
  {
    name: "Voyager 2",
    color: "#7ed7ff",
    position: { x: 39.370762, y: -104.309856, z: -88.304409 },
    minPixelRadius: 1.45,
    radiusKm: 0.005
  }
];

const DRIFTING_BODIES: DriftingBodyDefinition[] = [];

export const sceneBodyCatalog: SceneBodyCatalog = Object.freeze({
  VOYAGERS,
  DRIFTING_BODIES
});
