import { NextResponse } from "next/server";

export interface ClaudeModel {
  id: string;
  name: string;
}

/**
 * Known Claude models available via the CLI `--model` flag.
 * Update this list when new models are released.
 * Source: `claude models list` (as of 2026-04-26)
 */
const CLAUDE_MODELS: ClaudeModel[] = [
  { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
];

export async function GET() {
  return NextResponse.json(CLAUDE_MODELS);
}
