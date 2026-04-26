import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { getClaudePath, isClaudeAvailable } from "@/lib/claude-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ClaudeModel {
  id: string;
  name: string;
}

export async function GET() {
  if (!isClaudeAvailable()) {
    return NextResponse.json({ error: "Claude CLI not found" }, { status: 503 });
  }

  const claudePath = getClaudePath();

  const models = await new Promise<ClaudeModel[]>((resolve) => {
    const child = spawn(claudePath, ["models", "list"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.end();

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.on("close", () => {
      const rows: ClaudeModel[] = [];
      // Each data row looks like: | Claude Opus 4.7 | `claude-opus-4-7` | 1M | ...
      // We match: plain-text name cell, then backtick-wrapped id cell
      const rowRegex = /\|\s*([^|`][^|]*?)\s*\|\s*`([^`]+)`/g;
      let match: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((match = rowRegex.exec(output)) !== null) {
        const name = match[1].trim();
        const id = match[2].trim();
        // Skip header rows
        if (name.toLowerCase() === "model" || id.toLowerCase() === "id") continue;
        rows.push({ id, name });
      }
      resolve(rows);
    });

    child.on("error", () => resolve([]));
  });

  if (models.length === 0) {
    return NextResponse.json({ error: "No models found" }, { status: 502 });
  }

  return NextResponse.json(models);
}
