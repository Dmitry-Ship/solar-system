import { useEffect, useRef, useState } from "react";
import { HudPanel } from "./components/hud-panel";
import type { HudSnapshot } from "./infrastructure/dom/hud-controller";
import { SolarSystemApplication } from "./runtime/solar-system-application";
import { setAppInstance } from "./runtime/app-runtime";

function reportRuntimeError(error: unknown) {
  console.error(error);
  let errorElement = document.getElementById("runtime-error");

  if (!errorElement) {
    errorElement = document.createElement("pre");
    errorElement.id = "runtime-error";
    errorElement.className = "app-error";
    document.body.appendChild(errorElement);
  }

  const reason = error instanceof Error ? error.message : String(error);
  errorElement.textContent = `Unable to initialize the 3D scene.\n${reason}`;
}

export default function App() {
  const appRef = useRef<SolarSystemApplication | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    let application: SolarSystemApplication | null = null;
    let unsubscribeHud = () => {};

    try {
      application = new SolarSystemApplication();
      appRef.current = application;
      setAppInstance(application);
      application.start();
      unsubscribeHud = application.subscribeToHud(setHudSnapshot);
    } catch (error) {
      reportRuntimeError(error);
      return;
    }

    return () => {
      unsubscribeHud();
      appRef.current = null;
      setHudSnapshot(null);
      setAppInstance(null);
      application?.dispose();
    };
  }, []);

  return (
    <>
      <canvas id="scene" aria-label="3D solar system model" />
      {hudSnapshot ? (
        <HudPanel
          snapshot={hudSnapshot}
          onSetPov={(pov) => appRef.current?.setPov(pov)}
          onToggleZoom={() => appRef.current?.toggleZoom()}
          onToggleNames={() => appRef.current?.toggleNames()}
          onToggleOrbits={() => appRef.current?.toggleOrbits()}
          onToggleVisibility={(key) => appRef.current?.toggleVisibility(key)}
        />
      ) : null}
    </>
  );
}
