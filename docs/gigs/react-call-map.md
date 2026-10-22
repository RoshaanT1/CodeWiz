# Gig 6 — React Call Map

## What it is

A React component that shows a function's callers and callees as an interactive graph. It is built on React Flow and does no data fetching of its own. You pass functions and calls as props, so it works with any data source.

## Files

| File | Purpose |
|---|---|
| `components/call-map/index.tsx` | Public entry point — exports `CallMap`, `CallMapFunction`, `CallMapCall`, `Category` |
| `components/call-map/build-graph.ts` | Pure function that turns props into React Flow nodes and edges |
| `components/call-map/function-node.tsx` | Custom React Flow node — renders the function card |
| `components/call-map/README.md` | README for Devmarketplace (install, usage, props, data shapes) |

## Code snippet (TypeScript)

```tsx
"use client";

import { useState } from "react";
import { CallMap } from "@/components/call-map";
import type { CallMapFunction, CallMapCall } from "@/components/call-map";

const functions: CallMapFunction[] = [
  { id: "a", name: "handleLogin",    file: "app/api/login/route.ts", category: "entry" },
  { id: "b", name: "verifyPassword", file: "lib/auth.ts",            category: "core"  },
  { id: "c", name: "getUserByEmail", file: "lib/db.ts",              category: "data"  },
  { id: "d", name: "hashPassword",   file: "lib/crypto.ts",          category: "helper"},
];

const calls: CallMapCall[] = [
  { callerId: "a", calleeId: "b" },
  { callerId: "b", calleeId: "c" },
  { callerId: "b", calleeId: "d" },
];

export default function Example() {
  const [selectedId, setSelectedId] = useState("b");

  return (
    <div style={{ height: 480 }}>
      <CallMap
        functions={functions}
        calls={calls}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}
```

## Devmarketplace form fields

| Field | Value |
|---|---|
| **Title** | React Call Map: callers and callees graph |
| **Description** | A React component that shows a function's callers and callees as an interactive graph, coloured by category. Click a node to move the view to it. Built on React Flow. |
| **Skills** | React, TypeScript, Next.js |
| **Custom tags** | React Flow, graph, call graph, visualisation, code navigation |
| **Code snippet language** | TypeScript |
| **Code snippet** | The `<CallMap />` block above |
| **README** | `components/call-map/README.md` — open on GitHub, copy the rendered page and paste into the rich-text editor |
| **Thumbnail** | `docs/gigs/thumbnails/react-call-map.png` |

## Dependencies added

| Package | Licence | Version pinned |
|---|---|---|
| `@xyflow/react` | MIT | ^12.x (installed via `npm install @xyflow/react`) |

Added to `AI_DISCLOSURE.md` under "Libraries".
