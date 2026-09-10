/** Registry for trusted server-side connectors. Credentials must be environment references, never frontend values. */
export class ConnectorRegistry {
  #connectors = new Map();
  register(name, connector) {
    if (typeof connector.read !== "function")
      throw new TypeError(
        "Connector requires async read({ indicator, signal, configuration })",
      );
    this.#connectors.set(name, connector);
  }
  async read(source, signal) {
    const connector = this.#connectors.get(source.type);
    if (!connector) throw new Error("Fonte de dados ainda não implementada.");
    const result = await connector.read({
      indicator: source.indicator,
      configuration: source.configuration,
      signal,
    });
    if (!Number.isFinite(result.value))
      throw new Error("A fonte retornou um indicador inválido.");
    return {
      value: result.value,
      observedAt: result.observedAt || new Date().toISOString(),
      sourceId: source.id,
    };
  }
}
export const connectors = new ConnectorRegistry();
