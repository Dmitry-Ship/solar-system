export interface AppRuntimeLike {
  start(): void;
  stop(): void;
  resize(): void;
  dispose(): void;
}

let activeAppInstance: AppRuntimeLike | null = null;

export function getAppInstance(): AppRuntimeLike | null {
  return activeAppInstance;
}

export function setAppInstance(appInstance: AppRuntimeLike | null): void {
  activeAppInstance = appInstance;
}
