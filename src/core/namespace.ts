import { container } from "./dependency-container";

export const namespace: any = {
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

export function registerService(key, Factory) {
  if (container) {
    container.register(key, (c) => new Factory(c));
  }

  namespace[key] = Factory;
}

export function registerInstance(key, instance) {
  if (container) {
    container.registerInstance(key, instance);
  }

  namespace[key] = instance;
}

namespace.core.registerService = registerService;
namespace.core.registerInstance = registerInstance;
