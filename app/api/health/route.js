import { siteConfig } from "../../lib/site";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: siteConfig.name,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
