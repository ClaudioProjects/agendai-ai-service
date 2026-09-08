import type { MiddlewareHandler } from "hono";
import { isApiError } from "../libs/errors";

export const observability: MiddlewareHandler = async (context, next) => {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  context.set("requestId", requestId);
  try {
    await next();
  } finally {
    const error = context.error;
    console.info(
      JSON.stringify({
        requestId,
        route: context.req.path,
        status: context.res.status,
        duration: Math.round(performance.now() - started),
        errorCode: isApiError(error) ? error.code : undefined,
      }),
    );
  }
};
