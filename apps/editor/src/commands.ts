export type CommandDefinition<T extends string = string> = {
  id: T;
  label: string;
  enabled: boolean;
  run: () => void | Promise<void>;
  shortcut?: string;
};

export type CommandRegistry<T extends string = string> = Record<T, CommandDefinition<T>>;

const shortcutModifierTokens = new Set(["alt", "mod", "shift"]);

export function createCommandRegistry<T extends string>(
  definitions: ReadonlyArray<CommandDefinition<T>>
): CommandRegistry<T> {
  return definitions.reduce((registry, command) => {
    registry[command.id] = command;
    return registry;
  }, {} as CommandRegistry<T>);
}

export function findCommandByShortcut<T extends string>(
  registry: CommandRegistry<T>,
  event: KeyboardEvent
): CommandDefinition<T> | null {
  for (const command of Object.values(registry) as Array<CommandDefinition<T>>) {
    if (command.shortcut && shortcutMatchesEvent(command.shortcut, event)) {
      return command;
    }
  }

  return null;
}

function shortcutMatchesEvent(shortcut: string, event: KeyboardEvent): boolean {
  const tokens = shortcut.toLowerCase().split("+");
  const key = tokens.find((token) => !shortcutModifierTokens.has(token));

  if (!key || event.key.toLowerCase() !== key) {
    return false;
  }

  const requiresShift = tokens.includes("shift");
  const requiresAlt = tokens.includes("alt");
  const requiresMod = tokens.includes("mod");
  const modPressed = event.ctrlKey || event.metaKey;

  return (
    event.shiftKey === requiresShift &&
    event.altKey === requiresAlt &&
    modPressed === requiresMod
  );
}
