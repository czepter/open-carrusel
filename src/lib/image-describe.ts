import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import path from "path";

const MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic(); // uses ANTHROPIC_API_KEY env var
  }
  return client;
}

/**
 * Detect image media type from file extension.
 */
function mediaType(
  filePath: string,
): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

/**
 * Generate a rich verbal description of an image using Claude vision.
 *
 * The description covers: subject matter, colors, typography, layout,
 * visual style, mood, and any text content visible in the image.
 * Designed to be useful both as human-readable metadata and as the
 * basis for term-frequency embeddings used in similarity search.
 */
export async function describeImage(absPath: string): Promise<string> {
  const imageBuffer = await readFile(absPath);
  const base64 = imageBuffer.toString("base64");
  const type = mediaType(absPath);

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: type, data: base64 },
          },
          {
            type: "text",
            text: `Describe this image in detail for use as design reference metadata. Cover:
1. Subject matter and content (objects, people, scenes, text visible)
2. Color palette (dominant colors, gradients, contrast)
3. Typography (if any — font styles, sizes, weight)
4. Layout and composition (alignment, spacing, visual hierarchy)
5. Visual style and mood (minimal, bold, playful, corporate, etc.)
6. Background treatment (solid, gradient, photo, pattern)

Be specific and use concrete design terminology. Write 3-5 sentences.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "No description available.";
}
