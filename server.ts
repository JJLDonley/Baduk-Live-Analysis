import { withElementVisibility } from "./server/frontend-elements.ts";

function safeClientPath(pathname: string): string | null {
  const normalized = new URL(pathname, "http://localhost").pathname;
  if (normalized.includes("..")) return null;
  if (!normalized.startsWith("/assets/") && !normalized.startsWith("/web/")) {
    return null;
  }
  return `client${normalized}`;
}

function envOrDefault(name: string, fallback: string): string {
  try {
    return Deno.env.get(name) ?? fallback;
  } catch {
    return fallback;
  }
}

const frontendHost = envOrDefault("BLA_FRONTEND_HOST", "127.0.0.1");
const frontendPort = Number(envOrDefault("BLA_FRONTEND_PORT", "8080"));

console.log(
  `[Server] Frontend listening on http://${frontendHost}:${frontendPort}`,
);

Deno.serve({ hostname: frontendHost, port: frontendPort }, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  console.log(`[Server] Request: ${pathname}`);

  try {
    // Handle favicon.ico
    if (pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // Serve ogs-ws.js file
    if (pathname === "/ogs-ws.js") {
      console.log("[Server] Serving ogs-ws.js");
      const ogsSocket = await Deno.readTextFile("client/ogs-ws.js");
      return new Response(ogsSocket, {
        headers: {
          "Content-Type": "application/javascript",
        },
      });
    }

    // Serve client assets (images, fonts, etc.)
    if (pathname.startsWith("/assets/")) {
      const filePath = safeClientPath(pathname);
      if (!filePath) return new Response("File not found", { status: 404 });
      try {
        const fileContent = await Deno.readFile(filePath);
        const extension = pathname.split(".").pop();

        let contentType = "text/plain";
        switch (extension) {
          case "css":
            contentType = "text/css";
            break;
          case "js":
            contentType = "application/javascript";
            break;
          case "png":
            contentType = "image/png";
            break;
          case "jpg":
          case "jpeg":
            contentType = "image/jpeg";
            break;
          case "gif":
            contentType = "image/gif";
            break;
          case "svg":
            contentType = "image/svg+xml";
            break;
          case "ttf":
            contentType = "font/ttf";
            break;
          case "woff":
            contentType = "font/woff";
            break;
          case "woff2":
            contentType = "font/woff2";
            break;
        }

        return new Response(fileContent, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (error) {
        console.error(`[Server] Error serving ${filePath}:`, error);
        return new Response("File not found", { status: 404 });
      }
    }

    // Serve web assets (CSS, JS, images from web folder)
    if (pathname.startsWith("/web/")) {
      const filePath = safeClientPath(pathname);
      if (!filePath) return new Response("File not found", { status: 404 });
      try {
        const fileContent = await Deno.readFile(filePath);
        const extension = pathname.split(".").pop();

        let contentType = "text/plain";
        switch (extension) {
          case "css":
            contentType = "text/css";
            break;
          case "js":
            contentType = "application/javascript";
            break;
          case "png":
            contentType = "image/png";
            break;
          case "jpg":
          case "jpeg":
            contentType = "image/jpeg";
            break;
          case "gif":
            contentType = "image/gif";
            break;
          case "svg":
            contentType = "image/svg+xml";
            break;
          case "ttf":
            contentType = "font/ttf";
            break;
          case "woff":
            contentType = "font/woff";
            break;
          case "woff2":
            contentType = "font/woff2";
            break;
        }

        return new Response(fileContent, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (error) {
        console.error(`[Server] Error serving ${filePath}:`, error);
        return new Response("File not found", { status: 404 });
      }
    }

    // Serve index.html for all other routes (including dynamic ones)
    // This includes /, /game/123456, /review/789, etc.
    console.log("[Server] Serving index.html");
    const index = withElementVisibility(
      await Deno.readTextFile("client/index.html"),
      url,
    );
    return new Response(index, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});
