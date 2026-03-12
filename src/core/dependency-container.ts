export type DependencyFactory<T> = (container: DependencyContainer) => T;

export class DependencyContainer {
  private readonly factories = new Map<string, DependencyFactory<unknown>>();
  private readonly singletons = new Map<string, unknown>();

  register<T>(key: string, factory: DependencyFactory<T>): void {
    this.factories.set(key, factory);
    this.singletons.delete(key);
  }

  registerInstance<T>(key: string, instance: T): void {
    this.singletons.set(key, instance);
    this.factories.delete(key);
  }

  get<T>(key: string): T {
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Dependency not registered: ${key}`);
    }

    const instance = factory(this) as T;
    this.singletons.set(key, instance);
    return instance;
  }

  has(key: string): boolean {
    return this.factories.has(key) || this.singletons.has(key);
  }

  getOrNull<T>(key: string): T | null {
    if (!this.has(key)) {
      return null;
    }

    return this.get<T>(key);
  }

  clear(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}

export const container = new DependencyContainer();
