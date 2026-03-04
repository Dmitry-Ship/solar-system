(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.core) {
    throw new Error("contracts bootstrap failed: missing core namespace.");
  }

  const CONTRACT_METHODS = Object.freeze({
    Initializable: Object.freeze(["initialize"]),
    Updatable: Object.freeze(["update"]),
    Resizable: Object.freeze(["resize"]),
    Disposable: Object.freeze(["dispose"])
  });

  function assertContract(name, instance, contextName = "object") {
    const methods = CONTRACT_METHODS[name];
    if (!methods) {
      throw new Error(`Unknown contract: ${name}`);
    }
    if (!instance) {
      throw new Error(`${contextName} does not implement ${name}: missing instance.`);
    }

    for (const methodName of methods) {
      if (typeof instance[methodName] !== "function") {
        throw new Error(
          `${contextName} does not implement ${name}: missing method ${methodName}().`
        );
      }
    }
  }

  function maybeCall(instance, methodName, args = []) {
    if (instance && typeof instance[methodName] === "function") {
      return instance[methodName](...args);
    }
    return undefined;
  }

  namespace.core.contracts = Object.freeze({
    CONTRACT_METHODS,
    assertContract,
    maybeCall
  });
})();
