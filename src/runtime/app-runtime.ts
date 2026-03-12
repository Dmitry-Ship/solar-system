import type { AppRuntimeLike } from "../types/solar-system";

let activeAppInstance: AppRuntimeLike | null = null;

export function getAppInstance(): AppRuntimeLike | null {
  return activeAppInstance;
}

export function setAppInstance(appInstance: AppRuntimeLike | null): void {
  activeAppInstance = appInstance;
}
