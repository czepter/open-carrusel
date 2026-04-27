import type { AspectRatio } from "@/types/carousel";
import type { CarouselFontSettings } from "@/types/carousel";
import { DIMENSIONS } from "@/types/carousel";

/**
 * Extract Google Font family names from slide HTML.
 * Looks for font-family declarations in inline styles and <style> tags.
 */
export function extractFontFamilies(html: string): string[] {
  const families = new Set<string>();
  // Match font-family: "Font Name" or font-family: 'Font Name' or font-family: Font Name
  const regex = /font-family:\s*['"]?([^;'"}\n]+?)['"]?\s*[;}"]/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    // Split on commas and take non-generic font names
    const generics = new Set([
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui",
      "inherit",
      "initial",
      "unset",
    ]);
    for (const part of raw.split(",")) {
      const name = part.trim().replace(/['"]/g, "");
      if (name && !generics.has(name.toLowerCase())) {
        families.add(name);
      }
    }
  }
  return Array.from(families);
}

const GENERIC_FONTS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy",
  "system-ui", "inherit", "initial", "unset",
]);

/**
 * Build a CSS override block for live preview/export.
 *
 * Strategy: parse inline style attributes to classify font families as
 * "heading" (font-size >= 40px) or "body" (font-size < 40px), then emit
 * targeted CSS selectors using attribute substring matching:
 *   [style*="EB Garamond"] { font-family: 'NewFont' !important; ... }
 *
 * A stylesheet !important beats an inline style without !important, so
 * these overrides apply without touching the stored HTML.
 */
function buildFontOverrideCSS(slideHtml: string, settings: CarouselFontSettings): string {
  const headingFamilies = new Set<string>();
  const bodyFamilies = new Set<string>();

  const styleAttrRegex = /style="([^"]*)"/gi;
  let m: RegExpExecArray | null;

  while ((m = styleAttrRegex.exec(slideHtml)) !== null) {
    const styleStr = m[1];
    const ffMatch = styleStr.match(/font-family:\s*['"]?([^;'"}\n,]+)/i);
    const fsMatch = styleStr.match(/font-size:\s*(\d+)/i);

    if (ffMatch) {
      const family = ffMatch[1].trim().replace(/['"]/g, "").trim();
      if (family && !GENERIC_FONTS.has(family.toLowerCase())) {
        const size = fsMatch ? parseInt(fsMatch[1]) : 16;
        if (size >= 40) headingFamilies.add(family);
        else bodyFamilies.add(family);
      }
    }
  }

  // If the same family is classified as both heading and body (slide uses one
  // font for all text), keep it only in headingFamilies so the heading rule
  // isn't silently overridden by the later body rule (same selector, later wins).
  for (const f of headingFamilies) bodyFamilies.delete(f);

  // Escape double-quotes inside family names to keep CSS selectors valid.
  const cssSafe = (f: string) => f.replace(/"/g, '\\"');

  const rules: string[] = [];

  if (headingFamilies.size > 0) {
    const sel = [...headingFamilies]
      .map((f) => `[style*="${cssSafe(f)}"]`)
      .join(",\n");
    rules.push(
      sel + " {\n" +
      "  font-family: '" + settings.headingFamily + "', serif !important;\n" +
      "  font-size: " + settings.headingSize + "px !important;\n" +
      "  font-weight: " + settings.headingWeight + " !important;\n" +
      "}"
    );
  }

  if (bodyFamilies.size > 0) {
    const sel = [...bodyFamilies]
      .map((f) => `[style*="${cssSafe(f)}"]`)
      .join(",\n");
    rules.push(
      sel + " {\n" +
      "  font-family: '" + settings.bodyFamily + "', sans-serif !important;\n" +
      "  font-size: " + settings.bodySize + "px !important;\n" +
      "  font-weight: " + settings.bodyWeight + " !important;\n" +
      "}"
    );
  }

  // Fallback: slide uses only <style> tags with no inline font-family
  if (headingFamilies.size === 0 && bodyFamilies.size === 0) {
    rules.push(
      "* {\n" +
      "  font-family: '" + settings.bodyFamily + "', sans-serif !important;\n" +
      "  font-weight: " + settings.bodyWeight + " !important;\n" +
      "}"
    );
  }

  // Global properties: letter-spacing, line-height, text-transform
  const globalParts: string[] = [
    "letter-spacing: " + settings.letterSpacing + "em !important",
    "line-height: " + settings.lineHeight + " !important",
  ];
  if (settings.textTransform !== "none") {
    globalParts.push("text-transform: " + settings.textTransform + " !important");
  }
  rules.push("* {\n  " + globalParts.join(";\n  ") + ";\n}");

  return rules.join("\n\n");
}

/**
 * Permanently rewrite a slide's HTML with font settings baked in.
 * - Rewrites font-family / font-size / font-weight in inline style attributes
 *   (size >= 40px => heading settings, otherwise => body settings)
 * - Adds / replaces a <style id="oc-font-settings"> block for global properties
 *
 * Exported so the apply-fonts API route can use it server-side.
 */
export function applyFontSettingsToHtml(
  html: string,
  settings: CarouselFontSettings
): string {
  let result = html;

  // Remove any existing oc-font-settings block before rewriting
  result = result.replace(/<style id="oc-font-settings">[\s\S]*?<\/style>\s*/g, "");

  // Rewrite inline style attributes
  result = result.replace(/style="([^"]*)"/g, (_: string, styleContent: string) => {
    const fsMatch = styleContent.match(/font-size:\s*(\d+)/i);
    const size = fsMatch ? parseInt(fsMatch[1]) : 0;
    const isHeading = size >= 40;
    let modified = styleContent;

    // Replace font-family
    if (/font-family:/i.test(modified)) {
      modified = modified.replace(
        /font-family:\s*(?:'[^']+'|"[^"]+"|[^;,\n'"]+)(?:\s*,\s*(?:'[^']+'|"[^"]+"|[^;,\n'"]+))*/i,
        isHeading
          ? "font-family: '" + settings.headingFamily + "', serif"
          : "font-family: '" + settings.bodyFamily + "', sans-serif"
      );
    }

    // Replace font-size (only when a px size was present)
    if (size > 0) {
      modified = modified.replace(
        /font-size:\s*\d+px/i,
        isHeading
          ? "font-size: " + settings.headingSize + "px"
          : "font-size: " + settings.bodySize + "px"
      );
    }

    // Replace font-weight
    if (/font-weight:/i.test(modified)) {
      modified = modified.replace(
        /font-weight:\s*\w+/i,
        "font-weight: " + (isHeading ? settings.headingWeight : settings.bodyWeight)
      );
    }

    return 'style="' + modified + '"';
  });

  // Prepend global style block for letter-spacing / line-height / text-transform
  const globalParts: string[] = [
    "letter-spacing: " + settings.letterSpacing + "em",
    "line-height: " + settings.lineHeight,
  ];
  if (settings.textTransform !== "none") {
    globalParts.push("text-transform: " + settings.textTransform);
  }
  const styleBlock =
    '<style id="oc-font-settings">* { ' + globalParts.join("; ") + '; }</style>\n';
  result = styleBlock + result;

  return result;
}

/**
 * Wraps slide body HTML into a full HTML document at the correct dimensions.
 * This is THE shared rendering contract between preview (iframe) and export (Puppeteer).
 *
 * When fontSettings are provided, a CSS override block is injected in the <head>
 * so that font-family, size, weight, spacing, and transform settings are applied
 * non-destructively (no stored HTML is modified).
 */
export function wrapSlideHtml(
  slideHtml: string,
  aspectRatio: AspectRatio,
  options?: { inlineFontCss?: string; fontSettings?: CarouselFontSettings }
): string {
  const { width, height } = DIMENSIONS[aspectRatio];

  // Collect font families: from the slide HTML + from fontSettings overrides
  const baseFamilies = extractFontFamilies(slideHtml);
  const fontFamilies: string[] = [...baseFamilies];
  if (options?.fontSettings) {
    for (const family of [
      options.fontSettings.headingFamily,
      options.fontSettings.bodyFamily,
    ]) {
      if (family && !fontFamilies.includes(family)) {
        fontFamilies.push(family);
      }
    }
  }

  let fontBlock = "";
  if (options?.inlineFontCss) {
    // For export: use inlined base64 @font-face CSS
    fontBlock = "<style>" + options.inlineFontCss + "</style>";
  } else if (fontFamilies.length > 0) {
    // For preview: use Google Fonts CDN link
    const params = fontFamilies
      .map(
        (f) =>
          "family=" + encodeURIComponent(f) + ":wght@300;400;500;600;700;800"
      )
      .join("&");
    fontBlock =
      '<link href="https://fonts.googleapis.com/css2?' + params + '&display=swap" rel="stylesheet">';
  }

  // Build font-settings override CSS (non-destructive live overrides)
  const fontOverrideBlock = options?.fontSettings
    ? '<style id="oc-font-override">\n' +
      buildFontOverrideCSS(slideHtml, options.fontSettings) +
      "\n</style>"
    : "";

  return "<!DOCTYPE html>\n" +
    "<html>\n" +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=' + width + ', initial-scale=1">\n' +
    "  " + fontBlock + "\n" +
    (fontOverrideBlock ? "  " + fontOverrideBlock + "\n" : "") +
    "  <style>\n" +
    "    * { margin: 0; padding: 0; box-sizing: border-box; }\n" +
    "    html, body { width: " + width + "px; height: " + height + "px; overflow: hidden; }\n" +
    "  </style>\n" +
    "</head>\n" +
    "<body>\n" +
    "  " + slideHtml + "\n" +
    "</body>\n" +
    "</html>";
}
