import { spawn } from "child_process";
import crossSpawn from "cross-spawn";
import { getClaudePath, isClaudeAvailable } from "./claude-path";

/**
 * Generate a rich verbal description of an image using Claude CLI.
 *
 * Uses the same auth method as the chat — the locally installed Claude CLI
 * with its existing authentication (no API key needed).
 *
 * The description covers: subject matter, colors, typography, layout,
 * visual style, mood, and any text content visible in the image.
 * Designed to be useful both as human-readable metadata and as the
 * basis for term-frequency embeddings used in similarity search.
 */
export async function describeImage(absPath: string): Promise<string> {
  if (!isClaudeAvailable()) {
    throw new Error("Claude CLI not available");
  }

  const claudePath = getClaudePath();

  const prompt = `Read the image at "${absPath}" and describe it in detail for use as design reference metadata. Cover:
1. Subject matter and content (objects, people, scenes, text visible)
2. Color palette (dominant colors, gradients, contrast)
3. Typography (if any — font styles, sizes, weight)
4. Layout and composition (alignment, spacing, visual hierarchy)
5. Visual style and mood (minimal, bold, playful, corporate, etc.)
6. Background treatment (solid, gradient, photo, pattern)

Be specific and use concrete design terminology. Write 3-5 sentences. Output ONLY the description, no preamble.`;

  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--allowedTools",
    "Read",
    "--max-turns",
    "2",
    "--max-budget-usd",
    "0.05",
  ];

  const isWindowsShim =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(claudePath);
  const spawner = isWindowsShim ? crossSpawn : spawn;

  return new Promise<string>((resolve, reject) => {
    const child = spawner(claudePath, args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin?.end();

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Timeout: kill after 60 seconds
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Claude CLI timed out describing image"));
    }, 60_000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(
          new Error(
            `Claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`
          )
        );
        return;
      }

      try {
        // Claude CLI --output-format json returns { result: "...", ... }
        const parsed = JSON.parse(stdout);
        const result =
          typeof parsed.result === "string"
            ? parsed.result
            : typeof parsed === "string"
              ? parsed
              : "No description available.";
        resolve(result.trim());
      } catch {
        // If not valid JSON, treat stdout as plain text
        resolve(stdout.trim() || "No description available.");
      }
    });
  });
}
