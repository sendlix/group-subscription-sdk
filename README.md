# @sendlix/group

> Subscribe users to Sendlix mailing groups – with optional Proof-of-Work bot protection and ready-made React components.

[![npm](https://img.shields.io/npm/v/@sendlix/group)](https://www.npmjs.com/package/@sendlix/group)
[![license](https://img.shields.io/npm/l/@sendlix/group)](LICENSE)

## Installation

```bash
npm install @sendlix/group
```

React components are included in the same package and available via the `/react` sub-path:

```bash
# No extra install needed – React is a peer dependency
npm install react
```

---

## Quick start

### Subscribe an email address

```ts
import { subscribeToGroup } from "@sendlix/group";

const result = await subscribeToGroup({
  id: "your-group-id",
  email: "user@example.com",
});
// { success: true, code: 0, message: "Email added to group" }
```

### With Proof-of-Work bot protection

```ts
import { subscribeToGroup, ProofOfWork } from "@sendlix/group";

const pow = new ProofOfWork("your-group-id");

// Pre-warm the WebGPU pipeline (optional, call on page load)
pow.init();

const { token, nonce } = await pow.solve("user@example.com");

const result = await subscribeToGroup({
  id: "your-group-id",
  email: "user@example.com",
  botProtection: { type: "proofOfWork", token, nonce },
});

// Release resources when done
pow.close();
```

### With template placeholders

```ts
await subscribeToGroup({
  id: "your-group-id",
  email: "user@example.com",
  substitute: {
    "##First Name##": "Alice",
    "##Last Name##": "Smith",
  },
});
```

---

## React components

### `GroupIframe` – embed the hosted form

```tsx
import { GroupIframe } from "@sendlix/group/react";

<GroupIframe
  id="your-group-id"
  appearance={{
    primaryColor: "oklch(0.65 0.12 87)",
    backgroundColor: "white",
    textColor: "black",
    name: "Newsletter",
    info: "No spam, unsubscribe at any time.",
  }}
/>;
```

The iframe resizes automatically when the hosted form changes height. All standard `<iframe>` attributes are forwarded.

| Prop          | Type         | Default | Description                 |
| ------------- | ------------ | ------- | --------------------------- |
| `id`          | `string`     | –       | Group ID                    |
| `appearance`  | `Appearance` | –       | Visual customisation        |
| `startHeight` | `number`     | `500`   | Initial iframe height in px |

### `ProofOfWorkInput` – drop-in email input with PoW

A replacement for `<input type="email">` that automatically runs the Proof-of-Work challenge on blur and injects hidden `pow-token` / `pow-nonce` fields into the surrounding `<form>`.

```tsx
import { ProofOfWorkInput } from "@sendlix/group/react";

function SubscribeForm() {
  const [status, setStatus] = useState<string>();

  return (
    <form method="POST" action="https://group.sendlix.com/your-group-id">
      <ProofOfWorkInput
        sendlix={{ id: "your-group-id", onStatusChange: setStatus }}
        placeholder="your@email.com"
        required
      />
      {status === "loading" && <span>Solving challenge…</span>}
      {status === "processing" && <span>Renewing token…</span>}
      {status === "success" && <span>Ready</span>}
      {status === "error" && <span>PoW failed</span>}
      <button type="submit">Subscribe</button>
    </form>
  );
}
```

| Prop                     | Type                          | Description                       |
| ------------------------ | ----------------------------- | --------------------------------- |
| `sendlix.id`             | `string`                      | Group ID                          |
| `sendlix.onStatusChange` | `(status: PowStatus) => void` | Called on every status transition |

All standard `<input>` attributes are forwarded to the underlying email input.

---

## API reference

### `subscribeToGroup(options)`

```ts
subscribeToGroup(options: {
  id:              string;
  email:           string;
  substitute?:     Record<string, string>;
  botProtection?:  { type: "proofOfWork"; token: string; nonce: string };
}): Promise<GroupResponse>
```

### `subscribeToGroupWithFormData(data, id, substitute?)`

```ts
subscribeToGroupWithFormData(
  data:       FormData,
  id:         string,
  substitute?: Record<string, string>,
): Promise<GroupResponse>
```

Use this when you already have a native `<form>` and control the `FormData` yourself.

### `ProofOfWork`

```ts
const pow = new ProofOfWork(groupId: string, options?: PowOptions);
```

**Options**

| Option           | Type                          | Description                                             |
| ---------------- | ----------------------------- | ------------------------------------------------------- |
| `onStatusChange` | `(status: PowStatus) => void` | Called on every status change                           |
| `onRenew`        | `(result: PowResult) => void` | Called when the token is silently renewed before expiry |

**Methods**

| Method             | Returns              | Description                                                            |
| ------------------ | -------------------- | ---------------------------------------------------------------------- |
| `pow.solve(email)` | `Promise<PowResult>` | Requests a challenge and solves it. Schedules automatic renewal.       |
| `pow.init()`       | `void`               | Pre-warms the WebGPU pipeline. Call on component mount.                |
| `pow.close()`      | `void`               | Cancels the renewal timer and releases GPU resources. Call on unmount. |

Uses **WebGPU** when available for GPU-accelerated solving, with an automatic fallback to the **Web Crypto API** (CPU).

### Types

```ts
type PowResult = { token: string; nonce: string };
type PowStatus = "loading" | "processing" | "success" | "error";

type GroupResponse = {
  success: boolean;
  code: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  message: string;
};
```

---

## Development

```bash
npm install        # install dependencies
npm test           # run Jest test suite
npm run build      # compile TypeScript → ./dist
```

## Releases

Releases are automated via [semantic-release](https://semantic-release.gitbook.io) on every push to `main`. Use [Conventional Commits](https://www.conventionalcommits.org) for your commit messages:

| Prefix                        | Release type  |
| ----------------------------- | ------------- |
| `fix:`                        | Patch (0.0.x) |
| `feat:`                       | Minor (0.x.0) |
| `feat!:` / `BREAKING CHANGE:` | Major (x.0.0) |

Required repository secrets: `NPM_TOKEN`.

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.