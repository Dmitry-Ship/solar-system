import type { PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import { namespace } from "../../core/namespace";
import { RuntimeVisibilityService } from "./runtime-visibility-service";
import type {
  RuntimeThreeModule,
  SceneObjectRuntime,
  VisibilityStateLike
} from "../../types/solar-system";

interface LabelProjectionServiceOptions {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  sceneObjectRuntimes?: SceneObjectRuntime[];
  bodyRuntimes?: SceneObjectRuntime[];
  state: VisibilityStateLike;
  projectionScratch?: Vector3;
  runtimeVisibility?: RuntimeVisibilityService;
  THREE?: RuntimeThreeModule;
}

export class LabelProjectionService {
  private readonly renderer: WebGLRenderer;
  private readonly camera: PerspectiveCamera;
  private readonly sceneObjectRuntimes: SceneObjectRuntime[];
  private readonly state: VisibilityStateLike;
  private readonly projectionScratch: Vector3;
  private readonly runtimeVisibility: RuntimeVisibilityService;

  constructor(options: LabelProjectionServiceOptions) {
    const THREE = options.THREE || namespace.runtime.THREE;
    if (!THREE) {
      throw new Error("LabelProjectionService: missing THREE.");
    }

    this.renderer = options.renderer;
    this.camera = options.camera;
    this.sceneObjectRuntimes = options.sceneObjectRuntimes || options.bodyRuntimes || [];
    this.state = options.state;
    this.projectionScratch = options.projectionScratch || new THREE.Vector3();
    this.runtimeVisibility =
      options.runtimeVisibility || new RuntimeVisibilityService({ state: this.state });
  }

  update(): void {
    const viewportWidth = this.renderer.domElement.clientWidth;
    const viewportHeight = this.renderer.domElement.clientHeight;
    const halfFovTangent = Math.tan((this.camera.fov * Math.PI) / 360);

    for (const runtime of this.sceneObjectRuntimes) {
      const distance = Math.max(1e-6, this.camera.position.distanceTo(runtime.mesh.position));
      const pixelsPerWorldUnit = viewportHeight / (2 * distance * halfFovTangent);

      const pixelRadius = Math.max(
        runtime.minPixelRadius,
        runtime.renderRadius * pixelsPerWorldUnit
      );
      const worldRadius = Math.max(1e-6, pixelRadius / pixelsPerWorldUnit);

      runtime.mesh.scale.setScalar(worldRadius);

      if (!runtime.labelElement) continue;

      if (
        (!this.state.showBodyNames && runtime.togglesWithNamesButton) ||
        (runtime.togglesWithVisibilityControl &&
          !this.runtimeVisibility.isRuntimeVisible(runtime))
      ) {
        runtime.labelElement.style.display = "none";
        continue;
      }

      const labelAnchorPosition = runtime.labelAnchorPosition || runtime.mesh.position;
      this.projectionScratch.copy(labelAnchorPosition).project(this.camera);
      const isVisible =
        this.projectionScratch.z > -1 &&
        this.projectionScratch.z < 1 &&
        this.projectionScratch.x > -1.15 &&
        this.projectionScratch.x < 1.15 &&
        this.projectionScratch.y > -1.15 &&
        this.projectionScratch.y < 1.15;

      if (!isVisible) {
        runtime.labelElement.style.display = "none";
        continue;
      }

      let labelPixelRadius = pixelRadius;
      if (runtime.labelAnchorRadius > 0) {
        const labelAnchorDistance = this.camera.position.distanceTo(labelAnchorPosition);
        if (labelAnchorDistance <= runtime.labelAnchorRadius + 1e-6) {
          runtime.labelElement.style.display = "none";
          continue;
        }

        const anchorPixelsPerWorldUnit =
          viewportHeight / (2 * labelAnchorDistance * halfFovTangent);
        labelPixelRadius = runtime.labelAnchorRadius * anchorPixelsPerWorldUnit;
      }

      const screenX = (this.projectionScratch.x * 0.5 + 0.5) * viewportWidth;
      const screenY =
        (-this.projectionScratch.y * 0.5 + 0.5) * viewportHeight -
        labelPixelRadius -
        runtime.labelMarginPixels;

      runtime.labelElement.style.display = "block";
      runtime.labelElement.style.transform = `translate(-50%, -100%) translate(${screenX.toFixed(
        2
      )}px, ${screenY.toFixed(2)}px)`;
    }
  }
}

namespace.application.services.LabelProjectionService = LabelProjectionService;
