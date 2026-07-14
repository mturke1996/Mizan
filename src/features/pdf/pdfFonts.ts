import { Font } from "@react-pdf/renderer";

const FONT_FAMILY = "Tajawal";

let registered = false;
let registerPromise: Promise<void> | null = null;

/**
 * Register Tajawal so Arabic glyphs render correctly in @react-pdf.
 * Safe to call multiple times; registration runs once.
 */
export async function ensurePdfFontsLoaded(): Promise<void> {
  if (registered) return;
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    Font.register({
      family: FONT_FAMILY,
      fonts: [
        { src: "/fonts/Tajawal-Regular.ttf", fontWeight: 400 },
        { src: "/fonts/Tajawal-Bold.ttf", fontWeight: 700 },
      ],
    });

    // Warm the font cache so the first invoice render is not blank.
    try {
      await Font.load({ fontFamily: FONT_FAMILY });
    } catch {
      // Font.load may fail offline; register still enables later fetch.
    }

    registered = true;
  })();

  try {
    await registerPromise;
  } catch (error) {
    registerPromise = null;
    throw error;
  }
}

export function getPdfFontFamily(): string {
  return FONT_FAMILY;
}
