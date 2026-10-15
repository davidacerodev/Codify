import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";

const MAX_JSON_BODY_BYTES = 16 * 1024;

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiEnvelope<T>>(
    { ok: true, data },
    { status, headers: responseHeaders() },
  );
}

export function apiFailure(message: string, status: number) {
  return NextResponse.json<ApiEnvelope<never>>(
    { ok: false, error: message },
    { status, headers: responseHeaders() },
  );
}

export function isSameOriginRequest(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export type ParsedJson<T> =
  | { ok: true; value: T }
  | { ok: false; response: ReturnType<typeof apiFailure> };

export async function parseJson<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<ParsedJson<T>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      ok: false,
      response: apiFailure("Se requiere un cuerpo JSON.", 415),
    };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: apiFailure("La solicitud supera el tamaño permitido.", 413),
    };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return {
      ok: false,
      response: apiFailure("No se pudo leer la solicitud.", 400),
    };
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: apiFailure("La solicitud supera el tamaño permitido.", 413),
    };
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: apiFailure("El cuerpo JSON no es válido.", 400),
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Solicitud inválida.";
    return {
      ok: false,
      response: apiFailure(message, 400),
    };
  }

  return { ok: true, value: parsed.data };
}

export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}
