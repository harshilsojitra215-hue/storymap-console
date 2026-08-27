import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";

/**
 * The GraphQL surface the challenge brief names explicitly. Point a GraphQL
 * client — or this project's own GraphiQL page, served here in a browser — at
 * /api/graphql and query `{ chapters { id title } }` directly.
 *
 * Needs the Node runtime, not the Edge one: the resolvers read a file off disk.
 */
export const runtime = "nodejs";

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

// Wrapped rather than re-exported directly: Next's generated route type always
// passes a second `{ params }` argument, and yoga's own handler signature
// declares an incompatible required second parameter, which fails Next's
// build-time route type check. A function declared with only the one
// parameter it actually uses satisfies both — TypeScript allows a callback
// with fewer parameters than the type it is assigned to expects.
async function handle(request: Request) {
  return handleRequest(request, {});
}

export { handle as GET, handle as POST, handle as OPTIONS };
