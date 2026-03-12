import { useEffect } from "react";
import { namespace } from "./core/namespace";
import { SolarSystemApplication } from "./runtime/load-solar-system";

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
  useEffect(() => {
    let app: SolarSystemApplication | null = null;

    try {
      app = new SolarSystemApplication();
      namespace.runtime.appInstance = app;
      app.start();
    } catch (error) {
      reportRuntimeError(error);
      return;
    }

    return () => {
      if (namespace.runtime?.appInstance === app) {
        namespace.runtime.appInstance = null;
      }
      app?.dispose();
    };
  }, []);

  return (
    <>
      <canvas id="scene" aria-label="3D solar system model" />
      <section className="hud" aria-label="Instructions">
        <div className="hud-controls">
          <button id="zoom-toggle" className="zoom-button" type="button">
            Switch to Minimum Zoom
          </button>
          <button id="names-toggle" className="zoom-button" type="button" aria-pressed="true">
            Hide Body Names
          </button>
          <button id="orbits-toggle" className="zoom-button" type="button" aria-pressed="true">
            Hide Orbits
          </button>
        </div>
        <div id="visibility-controls-root" aria-label="Visibility controls" />
      </section>
    </>
  );
}
