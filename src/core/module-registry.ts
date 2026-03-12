import { namespace } from "./namespace";

type ModuleFactory<T> = (registry: ModuleRegistry) => T;

interface ModuleDefinition<T> {
  factory: ModuleFactory<T>;
  dependencies: string[];
  instance: T | null;
}

export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition<unknown>>();

  register<T>(name: string, factory: ModuleFactory<T>, dependencies: string[] = []): void {
    this.modules.set(name, { factory, dependencies, instance: null });
  }

  get<T>(name: string): T {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module not registered: ${name}`);
    }

    if (!module.instance) {
      module.instance = module.factory(this);
    }

    return module.instance as T;
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }

  getOrNull<T>(name: string): T | null {
    if (!this.has(name)) {
      return null;
    }

    return this.get<T>(name);
  }
}

export const registry = new ModuleRegistry();

namespace.core.registry = registry;
namespace.core.ModuleRegistry = ModuleRegistry;
