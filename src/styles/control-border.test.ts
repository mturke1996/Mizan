import globalsCss from "./globals.css?raw";
import tokensCss from "./tokens.css?raw";

function blockFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tokensCss.match(
    new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  expect(match, `Missing CSS block ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

function hexToken(block: string, token: string): string {
  const match = block.match(
    new RegExp(`--${token}:\\s*(#[\\da-f]{6})\\s*;`, "i"),
  );
  expect(match, `Missing opaque hex token --${token}`).not.toBeNull();
  return match?.[1] ?? "#000000";
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return (
    0.2126 * (linear[0] ?? 0) +
    0.7152 * (linear[1] ?? 0) +
    0.0722 * (linear[2] ?? 0)
  );
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(
    relativeLuminance(first),
    relativeLuminance(second),
  );
  const darker = Math.min(
    relativeLuminance(first),
    relativeLuminance(second),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("control border tokens", () => {
  it("maintains at least 3:1 contrast against control surfaces in both themes", () => {
    const light = blockFor(":root");
    const dark = blockFor('[data-theme="dark"]');

    expect(
      contrastRatio(
        hexToken(light, "mizan-control-border"),
        hexToken(light, "mizan-surface"),
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        hexToken(light, "mizan-control-border"),
        hexToken(light, "mizan-surface-strong"),
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        hexToken(dark, "mizan-control-border"),
        hexToken(dark, "mizan-surface"),
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        hexToken(dark, "mizan-control-border"),
        hexToken(dark, "mizan-surface-strong"),
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it("exposes a dedicated utility while preserving decorative divider tokens", () => {
    expect(globalsCss).toContain(
      "--color-control-border: var(--mizan-control-border);",
    );
    expect(tokensCss).toContain("--mizan-border: rgb(25 28 54 / 8%);");
    expect(tokensCss).toContain("--mizan-border-strong: rgb(25 28 54 / 14%);");
    expect(tokensCss).toContain("--mizan-border: rgb(244 246 255 / 8%);");
    expect(tokensCss).toContain("--mizan-border-strong: rgb(244 246 255 / 14%);");
  });
});
