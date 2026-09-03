import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

export function validate(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.parse({
      body: request.body,
      params: request.params,
      query: request.query,
    }) as {
      body: Request["body"];
      params: Request["params"];
      query: Request["query"];
    };
    request.body = parsed.body;
    Object.assign(request.params, parsed.params);
    Object.assign(request.query, parsed.query);
    next();
  };
}
