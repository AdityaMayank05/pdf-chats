export const runtime = "nodejs";

import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// Use dynamic base URL for callbacks
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    callbackUrl: `${baseUrl}/api/uploadthing`,
  },
});
