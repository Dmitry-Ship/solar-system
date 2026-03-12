import type { BufferGeometry, Group, PerspectiveCamera, Points, PointsMaterial } from "three";
import { RuntimeThree } from "../../../runtime/three-globals";
import type {
  BeltRuntime,
  RuntimeThreeModule,
  SceneData
} from "../../../types/solar-system";

interface ParticleRendererOptions {
  THREE?: RuntimeThreeModule;
}

type BeltPoints = Points<BufferGeometry, PointsMaterial>;

export class ParticleRenderer {
  private readonly THREE: RuntimeThreeModule;

  constructor(options: ParticleRendererOptions) {
    const THREE = options.THREE || RuntimeThree;
    if (!THREE) {
      throw new Error("ParticleRenderer: THREE is required.");
    }
    this.THREE = THREE;
  }

  static clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  static inverseLerp(start: number, end: number, value: number): number {
    if (Math.abs(end - start) < 1e-6) {
      return value >= end ? 1 : 0;
    }

    return ParticleRenderer.clamp01((value - start) / (end - start));
  }

  static smoothstep(start: number, end: number, value: number): number {
    const t = ParticleRenderer.inverseLerp(start, end, value);
    return t * t * (3 - 2 * t);
  }

  buildStarField(sceneData: SceneData, particleGroup: Group): void {
    const { THREE } = this;
    const positions = sceneData.stars.positions;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: "#dbe6ff",
        size: 1.2,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: false,
        depthWrite: false
      })
    );

    particleGroup.add(stars);
  }

  buildAsteroidBelts(
    sceneData: SceneData,
    particleGroup: Group,
    beltRuntimes: BeltRuntime[],
    _math?: unknown,
    _orbitalPositionScratch?: unknown
  ): void {
    const { THREE } = this;

    for (const belt of sceneData.asteroidBelts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(belt.positions, 3));
      const baseOpacity = Math.min(
        belt.maxOpacity ?? 0.22,
        belt.alpha * (belt.opacityScale ?? 0.2)
      );

      const points: BeltPoints = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: belt.color,
          size: belt.particleSize ?? 0.02,
          transparent: true,
          opacity: baseOpacity,
          sizeAttenuation: true,
          depthWrite: false
        })
      );

      particleGroup.add(points);
      beltRuntimes.push({
        belt,
        points,
        innerAu: belt.innerAu,
        outerAu: belt.outerAu,
        baseOpacity,
        minOpacityFactor: belt.minOpacityFactor ?? 0.12,
        fadeStartAngularRadius: belt.fadeStartAngularRadius ?? 0.08,
        fadeEndAngularRadius: belt.fadeEndAngularRadius ?? 0.02
      });
    }
  }

  updateAsteroidBeltVisuals(
    beltRuntimes: BeltRuntime[],
    camera: PerspectiveCamera | null
  ): void {
    if (!camera || !Array.isArray(beltRuntimes) || beltRuntimes.length === 0) {
      return;
    }

    const cameraDistance = Math.max(camera.position.length(), 1e-4);

    for (const beltRuntime of beltRuntimes) {
      const {
        points,
        baseOpacity,
        minOpacityFactor,
        fadeStartAngularRadius,
        fadeEndAngularRadius,
        innerAu,
        outerAu
      } = beltRuntime;

      const beltRadius = ((innerAu || 0) + (outerAu || 0)) * 0.5;
      const angularRadius = beltRadius / cameraDistance;
      const closeVisibility = ParticleRenderer.smoothstep(
        fadeEndAngularRadius,
        fadeStartAngularRadius,
        angularRadius
      );
      const opacityFactor = minOpacityFactor + (1 - minOpacityFactor) * closeVisibility;
      (points as BeltPoints).material.opacity = baseOpacity * opacityFactor;
    }
  }
}
