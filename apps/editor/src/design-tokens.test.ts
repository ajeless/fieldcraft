import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyTokensToRoot,
  cssCustomPropertyNames,
  darkTokens,
  lightTokens
} from "./design-tokens";

type StubStyle = {
  setProperty: (name: string, value: string) => void;
  getPropertyValue: (name: string) => string;
  colorScheme: string;
  _entries: () => Record<string, string>;
};

type StubDocument = {
  documentElement: {
    style: StubStyle;
    dataset: Record<string, string | undefined>;
  };
};

function createStubStyle(): StubStyle {
  const props = new Map<string, string>();
  let colorScheme = "";
  return {
    setProperty(name: string, value: string) {
      props.set(name, value);
    },
    getPropertyValue(name: string) {
      return props.get(name) ?? "";
    },
    get colorScheme() {
      return colorScheme;
    },
    set colorScheme(value: string) {
      colorScheme = value;
    },
    _entries() {
      return Object.fromEntries(props);
    }
  };
}

const globalAsRecord = globalThis as unknown as Record<string, unknown>;
const originalDocument = globalAsRecord.document;
let stubDocument: StubDocument;

beforeEach(() => {
  stubDocument = {
    documentElement: {
      style: createStubStyle(),
      dataset: {}
    }
  };
  globalAsRecord.document = stubDocument;
});

afterEach(() => {
  if (originalDocument === undefined) {
    delete globalAsRecord.document;
  } else {
    globalAsRecord.document = originalDocument;
  }
});

describe("design tokens", () => {
  it("dark and light tables share the same key set", () => {
    expect(new Set(Object.keys(darkTokens))).toEqual(new Set(Object.keys(lightTokens)));
  });

  it("applyTokensToRoot('dark') writes every token as a --fc-* custom property", () => {
    applyTokensToRoot("dark");
    const entries = stubDocument.documentElement.style._entries();
    for (const key of Object.keys(darkTokens) as Array<keyof typeof darkTokens>) {
      const cssName = cssCustomPropertyNames[key];
      expect(cssName.startsWith("--fc-")).toBe(true);
      const raw = darkTokens[key];
      const expected = typeof raw === "number" ? `${raw}px` : raw;
      expect(entries[cssName]).toBe(expected);
    }
    expect(stubDocument.documentElement.dataset.theme).toBe("dark");
    expect(stubDocument.documentElement.style.colorScheme).toBe("dark");
  });

  it("switching themes overwrites previous token values instead of accumulating them", () => {
    applyTokensToRoot("dark");
    applyTokensToRoot("light");
    const entries = stubDocument.documentElement.style._entries();
    expect(entries[cssCustomPropertyNames.bg0]).toBe(lightTokens.bg0);
    expect(entries[cssCustomPropertyNames.ink]).toBe(lightTokens.ink);
    expect(entries[cssCustomPropertyNames.accent]).toBe(lightTokens.accent);
    expect(Object.keys(entries).length).toBe(Object.keys(lightTokens).length);
    expect(stubDocument.documentElement.dataset.theme).toBe("light");
  });
});
