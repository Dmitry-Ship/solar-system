import { useEffect, useState } from "react";
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
  const [app, setApp] = useState<SolarSystemApplication | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    let application: SolarSystemApplication | null = null;
    let unsubscribeHud = () => {};

    try {
      application = new SolarSystemApplication();
      setAppInstance(application);
      application.start();
      unsubscribeHud = application.subscribeToHud(setHudSnapshot);
      setHudSnapshot(application.getHudSnapshot());
      setApp(application);
    } catch (error) {
      reportRuntimeError(error);
      return;
    }

    return () => {
      unsubscribeHud();
      setApp(null);
      setHudSnapshot(null);
      if (application) {
        setAppInstance(null);
      }
      application?.dispose();
    };
  }, []);

  return (
    <>
      <canvas id="scene" aria-label="3D solar system model" />
      <HudPanel
        snapshot={hudSnapshot}
        onSetPov={(pov) => app?.setPov(pov)}
        onToggleZoom={() => app?.toggleZoom()}
        onToggleNames={() => app?.toggleNames()}
        onToggleOrbits={() => app?.toggleOrbits()}
        onToggleVisibility={(key) => app?.toggleVisibility(key)}
      />
    </>
  );
}
