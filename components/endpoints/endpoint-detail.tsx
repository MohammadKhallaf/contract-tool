"use client";
import type { Endpoint } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "./confidence-badge";

interface Props {
  endpoint: Endpoint;
}

export function EndpointDetail({ endpoint }: Props) {
  return (
    <div className="p-4 space-y-3 text-sm bg-muted/30 rounded-b-lg border-t">
      {endpoint.confidence && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Spec match:</span>
          <ConfidenceBadge level={endpoint.confidence.level} score={endpoint.confidence.score} />
          {endpoint.confidence.matchedEndpoint && (
            <code className="text-xs bg-muted px-1 rounded">
              {endpoint.confidence.matchedEndpoint}
            </code>
          )}
          {endpoint.confidence.reason && (
            <span className="text-muted-foreground text-xs">{endpoint.confidence.reason}</span>
          )}
        </div>
      )}

      {endpoint.pathParams.length > 0 && (
        <div>
          <p className="font-medium mb-1 text-xs text-muted-foreground uppercase tracking-wide">
            Path Parameters
          </p>
          <div className="space-y-1">
            {endpoint.pathParams.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <code className="font-mono bg-muted px-1 rounded">{p.name}</code>
                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                {p.required && <Badge variant="secondary" className="text-[10px]">required</Badge>}
                {p.description && <span className="text-muted-foreground text-xs">{p.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {endpoint.queryParams.length > 0 && (
        <div>
          <p className="font-medium mb-1 text-xs text-muted-foreground uppercase tracking-wide">
            Query Parameters
          </p>
          <div className="space-y-1">
            {endpoint.queryParams.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <code className="font-mono bg-muted px-1 rounded">{p.name}</code>
                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                {p.required && <Badge variant="secondary" className="text-[10px]">required</Badge>}
                {p.description && <span className="text-muted-foreground text-xs">{p.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {endpoint.requestBody && (
        <div>
          <p className="font-medium mb-1 text-xs text-muted-foreground uppercase tracking-wide">
            Request Body
          </p>
          <Badge variant="outline" className="text-[10px] mb-1">
            {endpoint.requestBody.contentType}
          </Badge>
          {endpoint.requestBody.schema && (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {endpoint.requestBody.schema}
            </pre>
          )}
        </div>
      )}

      {endpoint.responseBody && (
        <div>
          <p className="font-medium mb-1 text-xs text-muted-foreground uppercase tracking-wide">
            Response
          </p>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">
              {endpoint.responseBody.statusCode}
            </Badge>
            {endpoint.responseBody.isPaginated && (
              <Badge variant="secondary" className="text-[10px]">paginated</Badge>
            )}
          </div>
          {endpoint.responseBody.schema && (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {endpoint.responseBody.schema}
            </pre>
          )}
        </div>
      )}

      {endpoint.notes && (
        <div>
          <p className="font-medium mb-1 text-xs text-muted-foreground uppercase tracking-wide">
            Notes
          </p>
          <p className="text-muted-foreground whitespace-pre-wrap">{endpoint.notes}</p>
        </div>
      )}
    </div>
  );
}
