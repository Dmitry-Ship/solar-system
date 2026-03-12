import { container } from "./dependency-container";
import type { DependencyContainer } from "./dependency-container";
import type { NamespaceRoot } from "../types/solar-system";

export const namespace: NamespaceRoot = {
  core: {
    container
  },
  domain: {
    constants: {},
    math: {},
    catalogs: {}
  },
  application: {
    state: {},
    factories: {},
    services: {},
    systems: {}
  },
  infrastructure: {
    three: {
      renderers: {},
      controllers: {}
    },
    dom: {}
  },
  runtime: {},
  compat: {},
  debug: {}
};

type ConstructableService<T> = new (container: DependencyContainer) => T;

export function registerService<T>(key: string, Factory: ConstructableService<T>): void {
  container.register(key, (serviceContainer) => new Factory(serviceContainer));
  namespace.core[key] = Factory;
}

export function registerInstance<T>(key: string, instance: T): void {
  container.registerInstance(key, instance);
  namespace[key] = instance;
}

namespace.core.registerService = registerService;
namespace.core.registerInstance = registerInstance;
