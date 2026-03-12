import { namespace } from "../../../core/namespace";

  const NAMES_TOGGLE_TARGET_GROUPS = new Set(["planets", "dwarfPlanets", "comets"]);
  const LABEL_OBJECT_TYPE_BY_GROUP_KEY = {
    planets: "planet",
    dwarfPlanets: "dwarf-planet",
    comets: "comet"
  };

export class OrbitRenderer {
    [key: string]: any;

    constructor(options: any) {
      this.bodyRenderer = options.bodyRenderer;
      this.THREE = options.THREE || namespace.runtime.THREE;
      if (!this.THREE) {
        throw new Error("OrbitRenderer: THREE is required.");
      }
    }

    buildOrbitLine(points, color, opacity) {
      const { THREE } = this;

      const geometry = new THREE.BufferGeometry();
      const positionArray = new Float32Array(points.length * 3);

      let offset = 0;
      for (const point of points) {
        positionArray[offset] = point.x;
        positionArray[offset + 1] = point.y;
        positionArray[offset + 2] = point.z;
        offset += 3;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity
      });

      return new THREE.Line(geometry, material);
    }

    buildOrbitingBodies(
      sceneData,
      orbitGroup,
      bodyGroup,
      bodyGeometry,
      sceneObjectRuntimes,
      orbitingBodies,
      math
    ) {
      const orbitalPositionScratch = { x: 0, y: 0, z: 0 };
      const shouldPopulateOrbitingBodiesOutput = Array.isArray(orbitingBodies);
      const orbitRenderGroupConfigs =
        sceneData.orbitRenderGroupConfigs || sceneData.orbitRenderGroups;
      for (const orbitRenderGroup of orbitRenderGroupConfigs) {
        const orbitingBodiesInGroup = sceneData[orbitRenderGroup.key] || [];
        for (const orbitingBody of orbitingBodiesInGroup) {
          const orbitLine = this.buildOrbitLine(
            orbitingBody.orbitPath,
            orbitingBody.orbitColor,
            orbitingBody.orbitOpacity
          );
          orbitGroup.add(orbitLine);

          const fallbackMinPixelRadius = orbitRenderGroup.key === "planets" ? 1.25 : 1.1;
          const runtime = this.bodyRenderer.createBodyRuntime(
            {
              name: orbitingBody.name,
              color: orbitingBody.color,
              renderRadius: orbitingBody.renderRadius,
              minPixelRadius: orbitingBody.minPixelRadius || fallbackMinPixelRadius,
              orbitingBody,
              objectType:
                LABEL_OBJECT_TYPE_BY_GROUP_KEY[orbitRenderGroup.key] || "orbiting-body",
              togglesWithNamesButton: NAMES_TOGGLE_TARGET_GROUPS.has(orbitRenderGroup.key)
            },
            bodyGroup,
            bodyGeometry
          );

          math.orbitalPositionInto(
            orbitalPositionScratch,
            orbitingBody.orbitRadius,
            orbitingBody.theta,
            orbitingBody.inclination,
            orbitingBody.node,
            0,
            orbitingBody.eccentricity,
            orbitingBody.periapsisArg
          );

          runtime.mesh.position.set(
            orbitalPositionScratch.x,
            orbitalPositionScratch.y,
            orbitalPositionScratch.z
          );

          sceneObjectRuntimes.push(runtime);
          if (shouldPopulateOrbitingBodiesOutput) {
            orbitingBodies.push(orbitingBody);
          }
        }
      }
    }

    applyOrbitVisibility(state, orbitGroup) {
      if (!orbitGroup) return;
      orbitGroup.visible = state.showOrbits;
    }
  }

namespace.infrastructure.three.renderers.OrbitRenderer = OrbitRenderer;
