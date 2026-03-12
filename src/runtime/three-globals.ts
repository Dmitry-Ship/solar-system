import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { LuminosityHighPassShader } from "three/examples/jsm/shaders/LuminosityHighPassShader.js";
import { namespace } from "../core/namespace";
import type { RuntimeThreeModule } from "../types/solar-system";

const runtimeThree: RuntimeThreeModule = {
  ...THREE,
  OrbitControls,
  Pass,
  RenderPass,
  ShaderPass,
  EffectComposer,
  UnrealBloomPass,
  CopyShader,
  LuminosityHighPassShader
};

namespace.runtime.THREE = runtimeThree;

export { runtimeThree as RuntimeThree };
