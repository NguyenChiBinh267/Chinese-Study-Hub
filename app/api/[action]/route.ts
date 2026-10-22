import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { session, proof, denied, privateResponse } from "../../../lib/runtime";
import { configuration } from "../../../lib/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
const attempts: number[] = [];
export async function GET(req: NextRequest, { params }: Context) {
  const { action } = await params;
  if (action === "health") {
    try {
      configuration();
      return privateResponse(NextResponse.json({ ready: true }));
    } catch {
      return privateResponse(
        NextResponse.json({ ready: false }, { status: 503 }),
      );
    }
  }
  let s: ReturnType<typeof session> | undefined;
  try {
    if (action !== "proof")
      return privateResponse(
        NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
      );
    s = session(req);
    return s.finish(NextResponse.json(await proof(await s.owner())));
  } catch (e) {
    return s ? s.finish(denied(e)) : denied(e);
  }
}
export async function POST(req: NextRequest, { params }: Context) {
  let s: ReturnType<typeof session> | undefined;
  try {
    const { action } = await params;
    s = session(req);
    const text = await req.text();
    if (text.length > 4096) throw Error("INVALID_BODY");
    const input = JSON.parse(text);
    if (action === "login") {
      const now = Date.now();
      while (attempts[0] < now - 60000) attempts.shift();
      if (attempts.length >= 10)
        return s.finish(
          NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 }),
        );
      attempts.push(now);
      const v = z
        .strictObject({
          email: z.email().max(254),
          password: z.string().min(1).max(1024),
        })
        .parse(input);
      const r = await s.client.auth.signInWithPassword(v);
      if (r.error) throw Error("SESSION_REQUIRED");
      try {
        await s.owner();
      } catch (e) {
        await s.client.auth.signOut({ scope: "local" });
        throw e;
      }
      return s.finish(NextResponse.json({ signedIn: true }));
    }
    if (action === "logout") {
      z.strictObject({}).parse(input);
      const r = await s.client.auth.signOut({ scope: "local" });
      if (r.error) throw Error("LOGOUT_FAILED");
      return s.finish(NextResponse.json({ signedOut: true }));
    }
    if (action !== "proof")
      return s.finish(
        NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
      );
    const uid = await s.owner(),
      v = z.strictObject({ key: z.uuid() }).parse(input);
    return s.finish(NextResponse.json(await proof(uid, v.key)));
  } catch (e) {
    if(e instanceof z.ZodError||e instanceof SyntaxError||(e instanceof Error&&e.message==="INVALID_BODY")){
      const res=privateResponse(NextResponse.json({error:"INVALID_BODY"},{status:400}));
      return s?s.finish(res):res;
    }
    return s ? s.finish(denied(e)) : denied(e);
  }
}
