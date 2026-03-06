"use client";
import { useEffect, useRef } from "react";

const HTML_TEMPLATE = `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
  <style>body{margin:0}</style>
</head><body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => SwaggerUIBundle({
      spec: __SPEC__,
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    })
  </script>
</body></html>`;

interface SwaggerFrameProps {
  spec: Record<string, unknown>;
}

export function SwaggerFrame({ spec }: SwaggerFrameProps) {
  // Track the previous blob URL so we can revoke it when spec changes
  const prevUrl = useRef<string | null>(null);

  const html = HTML_TEMPLATE.replace("__SPEC__", JSON.stringify(spec));
  const blob = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  // Revoke the previous URL after the new one has been assigned
  useEffect(() => {
    const old = prevUrl.current;
    prevUrl.current = blobUrl;
    return () => {
      if (old) URL.revokeObjectURL(old);
    };
  });

  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
