import type {
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry
} from "three";
import { RuntimeThree } from "../../../runtime/three-globals";
import type {
  BodyRenderConfig,
  RuntimeThreeModule,
  SceneData,
  SceneObjectRuntime
} from "../../../types/solar-system";
import type { LabelLayerLike } from "../../dom/labels-layer";

interface BodyRendererOptions {
  labelsLayer: LabelLayerLike;
  THREE?: RuntimeThreeModule;
}

export class BodyRenderer {
  private readonly labelsLayer: LabelLayerLike;
  private readonly THREE: RuntimeThreeModule;

  constructor(options: BodyRendererOptions) {
    this.labelsLayer = options.labelsLayer;
    this.THREE = options.THREE ?? RuntimeThree;
  }

  createBodyMaterial(config: BodyRenderConfig): MeshLambertMaterial | MeshBasicMaterial {
    const { THREE } = this;
    const useLitMaterial = !config.emissive && config.lit !== false;
    const material = useLitMaterial
      ? new THREE.MeshLambertMaterial({
          color: config.color
        })
      : new THREE.MeshBasicMaterial({
          color: config.color,
          toneMapped: false
        });

    if (!useLitMaterial && config.emissive) {
      material.transparent = true;
      material.opacity = 0.95;
    }

    return material;
  }

  createSpacecraftMesh(material: Material): Group {
    const { THREE } = this;
    const group = new THREE.Group();
    const baseMaterial = material;
    const busMaterial = new THREE.MeshLambertMaterial({ color: "#c6ccd7" });
    const boomMaterial = new THREE.MeshLambertMaterial({ color: "#8b93a1" });

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.38, 0.08, 20),
      baseMaterial
    );
    antenna.rotation.z = Math.PI * 0.5;
    antenna.position.x = -0.34;
    group.add(antenna);

    const antennaMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10),
      boomMaterial
    );
    antennaMast.rotation.z = Math.PI * 0.5;
    antennaMast.position.x = -0.02;
    group.add(antennaMast);

    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.18), busMaterial);
    bus.position.x = 0.26;
    group.add(bus);

    const longBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.15, 8),
      boomMaterial
    );
    longBoom.rotation.z = Math.PI * 0.5;
    longBoom.position.x = 0.1;
    group.add(longBoom);

    const rtgBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.72, 8),
      boomMaterial
    );
    rtgBoom.position.set(0.08, -0.26, 0);
    rtgBoom.rotation.z = Math.PI * 0.32;
    group.add(rtgBoom);

    const rtg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.22, 10),
      busMaterial
    );
    rtg.position.set(0.18, -0.56, 0);
    rtg.rotation.z = Math.PI * 0.32;
    group.add(rtg);

    return group;
  }

  createRenderableMesh(
    config: BodyRenderConfig,
    bodyGeometry: SphereGeometry,
    material: Material
  ): Object3D {
    const { THREE } = this;

    if (config.objectType === "spacecraft") {
      return this.createSpacecraftMesh(material);
    }

    return new THREE.Mesh(bodyGeometry, material);
  }

  disableFrustumCulling(object3D: Object3D): void {
    object3D.traverse((child) => {
      child.frustumCulled = false;
    });
  }

  private setObjectPosition(object3D: Object3D, position: BodyRenderConfig["fixedPosition"]): void {
    object3D.position.set(position?.x ?? 0, position?.y ?? 0, position?.z ?? 0);
  }

  private createLabelAnchorPosition(
    position: BodyRenderConfig["labelAnchorPosition"]
  ): SceneObjectRuntime["labelAnchorPosition"] {
    if (!position) {
      return null;
    }

    const { THREE } = this;
    return new THREE.Vector3(position.x, position.y, position.z);
  }

  createBodyRuntime(
    config: BodyRenderConfig,
    bodyGroup: Group,
    bodyGeometry: SphereGeometry
  ): SceneObjectRuntime {
    const material = this.createBodyMaterial(config);
    const mesh = this.createRenderableMesh(config, bodyGeometry, material);
    this.setObjectPosition(mesh, config.fixedPosition);
    this.disableFrustumCulling(mesh);
    bodyGroup.add(mesh);

    return {
      mesh,
      labelElement: this.labelsLayer.createLabel(config.label || config.name, {
        objectType: config.objectType
      }),
      renderRadius: config.renderRadius,
      minPixelRadius: config.minPixelRadius ?? 1,
      orbitingBody: config.orbitingBody ?? config.orbitalSource ?? null,
      orbitalSource: config.orbitingBody ?? config.orbitalSource ?? null,
      togglesWithNamesButton: Boolean(config.togglesWithNamesButton),
      labelAnchorPosition: this.createLabelAnchorPosition(config.labelAnchorPosition),
      labelAnchorRadius: Math.max(0, config.labelAnchorRadius ?? 0),
      labelMarginPixels: Math.max(1, config.labelMarginPixels ?? 5)
    };
  }

  createLabelAnchorRuntime(config: BodyRenderConfig): SceneObjectRuntime {
    const { THREE } = this;
    const mesh = new THREE.Object3D();
    this.setObjectPosition(mesh, config.fixedPosition);

    return {
      mesh,
      labelElement: this.labelsLayer.createLabel(config.label || config.name || "", {
        objectType: config.objectType
      }),
      renderRadius: 0,
      minPixelRadius: 0,
      labelAnchorPosition: this.createLabelAnchorPosition(config.labelAnchorPosition),
      labelAnchorRadius: Math.max(0, config.labelAnchorRadius ?? 0),
      labelMarginPixels: Math.max(1, config.labelMarginPixels ?? 5)
    };
  }

  buildFixedBodies(
    sceneData: SceneData,
    bodyGroup: Group,
    bodyGeometry: SphereGeometry,
    sceneObjectRuntimes: SceneObjectRuntime[]
  ): void {
    for (const voyager of sceneData.voyagers) {
      sceneObjectRuntimes.push(
        this.createBodyRuntime(
          {
            name: voyager.name,
            color: voyager.color,
            renderRadius: voyager.renderRadius,
            minPixelRadius: voyager.minPixelRadius,
            objectType: "spacecraft",
            fixedPosition: voyager.position,
            togglesWithNamesButton: true
          },
          bodyGroup,
          bodyGeometry
        )
      );
    }

    for (const body of sceneData.driftingBodies) {
      sceneObjectRuntimes.push(
        this.createBodyRuntime(
          {
            name: body.name,
            color: body.color,
            renderRadius: body.renderRadius,
            minPixelRadius: body.minPixelRadius ?? 1.5,
            objectType: "interstellar-object",
            fixedPosition: body
          },
          bodyGroup,
          bodyGeometry
        )
      );
    }

    for (const marker of sceneData.directionalMarkers) {
      sceneObjectRuntimes.push(
        this.createBodyRuntime(
          {
            name: marker.name,
            label: marker.label,
            color: marker.color,
            renderRadius: 0,
            minPixelRadius: marker.minPixelRadius,
            objectType: "directional-marker",
            fixedPosition: marker,
            lit: false
          },
          bodyGroup,
          bodyGeometry
        )
      );
    }
  }
}
