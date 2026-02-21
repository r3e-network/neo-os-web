import { NextResponse } from "next/server";

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
