// mapshaper ne fournit pas de types : on déclare juste ce que les scripts utilisent.
declare module 'mapshaper' {
  const mapshaper: {
    applyCommands(
      commands: string,
      input: Record<string, unknown>,
    ): Promise<Record<string, string | Uint8Array>>;
  };
  export default mapshaper;
}
