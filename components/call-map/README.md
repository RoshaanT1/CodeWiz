<!-- Written before the code, from the plan in docs/GIGS.md. Check and update it when MAP-2 is done. -->

# React Call Map

A React component that shows a function's callers and callees as an interactive graph. Click any node to move the view to that function. Built on React Flow.

It does no data fetching. You pass in your functions and calls as props, so it works with any data source: a static analyser, an API, or a JSON file.

## What it shows

- The selected function in the middle
- The functions that call it on the left
- The functions it calls on the right
- Each node coloured by category: entry point, core logic, data access or helper

## Install

1. Copy the `call-map` folder into your project, for example to `components/call-map/`.
2. Install React Flow:

```bash
npm install @xyflow/react
```

3. Import React Flow's stylesheet once, for example in your root layout:

```tsx
import "@xyflow/react/dist/style.css";
```

## Usage

```tsx
"use client";

import { useState } from "react";
import { CallMap, type CallMapFunction, type CallMapCall } from "@/components/call-map";

const functions: CallMapFunction[] = [
  { id: "a", name: "handleLogin", file: "app/api/login/route.ts", category: "entry" },
  { id: "b", name: "verifyPassword", file: "lib/auth.ts", category: "core" },
  { id: "c", name: "getUserByEmail", file: "lib/db.ts", category: "data" },
  { id: "d", name: "hashPassword", file: "lib/crypto.ts", category: "helper" },
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

React Flow fills its parent, so give the parent element a height.

In the Next.js App Router, the component runs on the client. Server pages can still use it by passing data in as props.

## Props

| Prop | Type | Required | What it does |
|---|---|---|---|
| `functions` | `CallMapFunction[]` | Yes | Every function that can appear on the map |
| `calls` | `CallMapCall[]` | Yes | Who calls whom |
| `selectedId` | `string` | Yes | The function shown in the middle |
| `onSelect` | `(id: string) => void` | No | Called when a node is clicked. Update `selectedId` here to move the view |
| `maxNodes` | `number` | No | The most callers or callees shown on each side. Default: 20 |
| `categoryColors` | `Partial<Record<Category, string>>` | No | Override the colour for any category |
| `className` | `string` | No | Extra classes for the outer element |

## Data shapes

```ts
type Category = "entry" | "core" | "data" | "helper";

type CallMapFunction = {
  id: string;
  name: string;
  file?: string;
  category?: Category;
};

type CallMapCall = {
  callerId: string;
  calleeId: string;
};
```

Calls that point to an `id` not in `functions` are ignored.

## Limits

- Shows one step out from the selected function in each direction. Large graphs get slow and hard to read, so it never draws the whole graph at once.
- If a function has more callers or callees than `maxNodes`, the extra ones are left out and the map shows how many were hidden.
- Recursive calls (a function calling itself) are shown as a single loop on the selected node.

## Dependencies

| Package | Licence | Link |
|---|---|---|
| React (18 or later) | MIT | https://react.dev |
| @xyflow/react (React Flow) | MIT | https://reactflow.dev |

## Contributors

Built during the Build The Next Big Thing with AI hackathon (Devmarketplace x NED University) by team CodeWiz:

- Roshaan Tahir
- M Hammad Khan
- Fizzah Abdullah
- Hammad Khan

## Licence

MIT
