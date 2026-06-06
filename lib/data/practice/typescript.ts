import type { ConvItem } from "./types";

/**
 * TypeScript track — type-safety, async/Promise pitfalls, API contracts, generics,
 * narrowing. Mix of code-answer practice and interactive review items (language
 * "typescript"). Authored via gen_conv.py + gen_review.py.
 *
 * Sources (2025–2026 TS interview surface & real-world pitfalls):
 *  - https://www.typescriptlang.org/tsconfig/useUnknownInCatchVariables.html
 *  - https://typescript-eslint.io/rules/no-floating-promises/
 *  - https://www.totaltypescript.com/clarifying-the-satisfies-operator
 *  - https://github.com/microsoft/TypeScript/issues/47033
 *  - https://blog.logrocket.com/when-use-zod-typescript-both-developers-guide/
 */
export const TYPESCRIPT_ITEMS: ConvItem[] = [
  {
    id: "ts-001",
    category: "typescript",
    level: "junior",
    title: "unknown vs any vs never",
    company: "Frontend platform",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the practical difference between `unknown`, `any`, and `never` in TypeScript. When would you reach for each, and why is `unknown` usually preferred over `any` for values coming from outside your program (e.g. a parsed JSON body or a caught error)?",
    idealAnswer:
      "`any` opts out of type checking entirely: you can call, index, or assign it anywhere with no error, so it silently propagates and disables safety wherever it leaks. `unknown` is the type-safe top type — any value is assignable TO `unknown`, but you cannot DO anything with an `unknown` (call it, access properties, assign it to a narrower type) until you narrow it with a type guard, `typeof`/`instanceof` check, or schema validation. `never` is the bottom type: it has no values, is assignable to everything but nothing is assignable to it, and is what a function that never returns (throws or infinite-loops) is inferred as. Reach for `unknown` at trust boundaries — parsed JSON, `catch` variables, third-party data — because it forces you to validate before use. Use `never` for exhaustiveness checks and impossible states. Avoid `any` except as a deliberate, isolated escape hatch, because it defeats the entire point of using TypeScript.",
    rubric: [
      "any disables type checking and leaks unsoundness through the codebase",
      "unknown is the safe top type — must narrow before use",
      "never is the bottom type (no values; functions that never return)",
      "prefer unknown at trust boundaries (JSON, catch, external data)",
    ],
    hints: [
      "Think about which direction assignability flows for each.",
      "Which one forces you to do a check before you can use the value?",
    ],
  },
  {
    id: "ts-002",
    category: "typescript",
    level: "junior",
    title: "Structural typing surprise",
    company: "SaaS analytics",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "TypeScript uses structural typing, not nominal typing. Explain what that means with an example, and describe one bug it can let through. How would you make two structurally-identical types (e.g. `UserId` and `OrderId`, both numbers) NOT interchangeable?",
    idealAnswer:
      "Structural typing means a value is compatible with a type if its SHAPE matches — TypeScript does not care about declared names or where the type came from. So two interfaces with the same members are interchangeable, and an object literal with the required fields satisfies an interface even if it was never declared as that interface. The bug this allows: two domain concepts that happen to share a shape (e.g. both `UserId` and `OrderId` are `number`, or `Meters` and `Feet`) are freely swapped, so you can pass an order id where a user id is expected with no error. The fix is branded/nominal types: intersect the primitive with a unique, otherwise-unused tag, e.g. `type UserId = number & { readonly __brand: 'UserId' }`. Now a plain `number` (or an `OrderId`) is not assignable to `UserId`, and you mint values through a constructor/asserting function. This restores nominal safety where structural typing is too loose.",
    rubric: [
      "structural = compatibility by shape, not by name/declaration",
      "gives a concrete example of accidental interchangeability",
      "names a real bug (mixing up same-shaped domain types)",
      "branded/nominal types via intersection with a unique tag as the fix",
    ],
    hints: [
      "Does TypeScript check the name of a type or its members?",
      "How could you add an invisible 'tag' to a number to make it unique?",
    ],
  },
  {
    id: "ts-003",
    category: "typescript",
    level: "mid",
    title: "Discriminated unions & exhaustiveness",
    company: "Payments",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You model a payment result as a discriminated union:\n\n    type Result =\n      | { status: 'success'; amount: number }\n      | { status: 'pending'; etaSeconds: number }\n      | { status: 'failed'; reason: string };\n\nWrite (in prose or pseudocode) a `render(r: Result)` function that handles every case, and explain how to get a COMPILE-TIME error if a teammate later adds a `{ status: 'refunded' }` variant but forgets to update `render`.",
    idealAnswer:
      "Switch on the discriminant `r.status`. Inside each `case`, TypeScript narrows `r` to that exact variant, so `r.amount`, `r.etaSeconds`, and `r.reason` are each only accessible in their matching branch. To enforce exhaustiveness, add a `default` branch that assigns `r` to a variable of type `never`: `const _exhaustive: never = r;` (or call a helper `function assertNever(x: never): never { throw new Error('unhandled ' + JSON.stringify(x)); }`). Because the union is fully narrowed away in the handled cases, `r` in `default` has type `never` and the assignment compiles. The moment someone adds a `'refunded'` variant, that branch leaves `r` with type `{ status: 'refunded' }`, which is NOT assignable to `never`, producing a compile error that points exactly at the unhandled case. This turns 'forgot a case' from a runtime bug into a build failure. Note: this only works if you switch on the literal discriminant — switching on a non-literal or using `if` chains without narrowing loses the guarantee.",
    rubric: [
      "switches on the discriminant property; each case is narrowed",
      "uses an assertNever / `const _: never = r` in the default branch",
      "explains WHY the never assignment fails to compile when a case is added",
      "notes narrowing depends on the literal discriminant",
    ],
    hints: [
      "What type does TypeScript give `r` after all known cases are handled?",
      "Assigning a non-empty type to `never` is an error — exploit that.",
    ],
  },
  {
    id: "ts-004",
    category: "typescript",
    level: "mid",
    title: "Typing a caught error safely",
    company: "API gateway",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Review this error handling and explain what is unsafe, then show how to type it correctly:\n\n    try {\n      await chargeCard(order);\n    } catch (err) {\n      logger.error(err.message, err.code);\n    }\n\nAssume `strict` is on. What is the type of `err`, why does `err.message` not always work, and how do you handle it safely?",
    idealAnswer:
      "With `useUnknownInCatchVariables` (on under `strict` since TS 4.4), `err` has type `unknown`, not `Error` — so `err.message` and `err.code` are compile errors, and even if they weren't, a thrown value can be ANYTHING in JS (a string, `undefined`, a plain object), so blindly reading `.message` can throw a second error inside your catch. The safe pattern is to narrow before use: check `err instanceof Error` to safely read `err.message`, and treat `err.code` as a possibly-absent property you probe defensively (e.g. `if (err && typeof err === 'object' && 'code' in err)`), or normalize into a known shape. A common helper: `function toError(e: unknown): Error { return e instanceof Error ? e : new Error(String(e)); }` then log `toError(err).message`. Also note a gotcha: `useUnknownInCatchVariables` does NOT apply to `Promise.prototype.catch()` callbacks — their parameter is still typed `any` — so for promise `.catch(e => ...)` you should annotate `(e: unknown)` yourself.",
    rubric: [
      "err is unknown under strict (useUnknownInCatchVariables), so .message errors",
      "thrown values can be non-Error, so reading .message can throw again",
      "narrow with `err instanceof Error` / `'code' in err` before access",
      "mentions .catch() callback is still typed any — annotate unknown yourself",
    ],
    hints: [
      "What is the inferred type of a catch variable in strict mode?",
      "Can you `throw 'a string'` in JavaScript? What does that do to `.message`?",
    ],
  },
  {
    id: "ts-005",
    category: "typescript",
    level: "mid",
    title: "The floating promise",
    company: "Data pipeline",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A reviewer flags this loop in a TypeScript service:\n\n    for (const job of jobs) {\n      processJob(job); // processJob returns Promise<void>\n    }\n    return 'done';\n\nWhat is wrong, what are the consequences in production, and how would you fix it depending on whether the jobs are independent or must run in order?",
    idealAnswer:
      "`processJob` returns a Promise that is never awaited, returned, or `.catch`-ed — it is a floating promise. Consequences: the loop returns 'done' before any job actually finishes (the work runs out of band), and if any job rejects you get an unhandledRejection that can crash the Node process or be silently swallowed, with no backpressure on how many run at once. The fix depends on semantics. If jobs must run sequentially: `for (const job of jobs) { await processJob(job); }`. If they are independent and can run concurrently: `await Promise.all(jobs.map(j => processJob(j)));` — but be aware `Promise.all` fails fast on the first rejection. If you want every job attempted regardless of failures, use `Promise.allSettled` and then inspect each result. To catch this class of bug automatically, enable the `@typescript-eslint/no-floating-promises` lint rule, which flags any promise-valued statement that isn't awaited, returned, or explicitly voided.",
    rubric: [
      "identifies the unawaited (floating) promise; work isn't sequenced",
      "consequences: returns early, unhandled rejection / crash, no backpressure",
      "sequential fix (await in loop) vs concurrent fix (Promise.all/allSettled)",
      "mentions no-floating-promises ESLint rule to catch it",
    ],
    hints: [
      "Does anything wait for processJob before 'done' is returned?",
      "What happens to a rejection no one is listening for?",
    ],
  },
  {
    id: "ts-006",
    category: "typescript",
    level: "senior",
    title: "Promise.all vs allSettled typing",
    company: "Aggregation service",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A dashboard fetches user, billing, and feature-flag data in parallel. Compare `Promise.all` and `Promise.allSettled` for this: how do their RESULT TYPES differ, when does each rejection behavior bite you, and how do you safely read values out of `allSettled` results in a type-safe way?",
    idealAnswer:
      "`Promise.all([a, b, c])` resolves to a tuple of the resolved values `[A, B, C]` and rejects (fails fast) the instant any input rejects — so you either get all values or an error, and the rejection short-circuits the others. `Promise.allSettled([a, b, c])` never rejects; it resolves to a tuple of `PromiseSettledResult<T>` objects, each either `{ status: 'fulfilled'; value: T }` or `{ status: 'rejected'; reason: any }`. Choose by whether partial success is useful: for a dashboard where you'd rather render what you can and show an error per-widget, `allSettled` is right; if any missing piece means you must show a full error state (e.g. auth/current-user), `all` (fail-fast) is cleaner. Type safety with `allSettled`: you must check the discriminant before reading `value`, e.g. `if (userResult.status === 'fulfilled') { use(userResult.value) }` — the `status` field is a discriminated union, so TS only exposes `value` in the fulfilled branch and `reason` in the rejected branch. A common bug is reading `.value` unconditionally, which is a type error (and would be `undefined` at runtime for rejected entries).",
    rubric: [
      "all → tuple of values, fails fast on first rejection",
      "allSettled → never rejects, array of fulfilled|rejected settled results",
      "choice driven by whether partial success is useful",
      "must narrow on result.status before reading .value (discriminated union)",
    ],
    hints: [
      "What does each return when one promise rejects?",
      "PromiseSettledResult is itself a discriminated union on `status`.",
    ],
  },
  {
    id: "ts-007",
    category: "typescript",
    level: "senior",
    title: "satisfies vs type annotation vs as",
    company: "Design system",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the difference between `const config: Cfg = {...}`, `const config = {...} as Cfg`, and `const config = {...} satisfies Cfg`. Give a concrete case where `satisfies` is strictly better than both the annotation and the `as` cast. Mention how `as const satisfies` combines.",
    idealAnswer:
      "A type annotation (`: Cfg`) validates the literal against `Cfg` but WIDENS the variable to `Cfg`, so you lose the precise inferred shape — e.g. a `routes` object annotated as `Record<string, string>` no longer remembers its specific keys, so you can't autocomplete `config.routes.home`. An `as Cfg` cast does NOT validate at all: it forces the type even if the object is wrong or missing properties, silently hiding errors, and is purely an assertion. `satisfies Cfg` does both right things: it CHECKS that the literal is assignable to `Cfg` (so typos/missing keys error) WITHOUT widening — the variable keeps its narrow inferred type, preserving literal keys and value types for autocomplete and narrowing. Concrete win: `const palette = { primary: '#fff', danger: '#f00' } satisfies Record<string, string>` — you get the constraint check AND `keyof typeof palette` is `'primary' | 'danger'` rather than `string`. `as const satisfies Cfg` adds deep `readonly` and literal narrowing (numbers/strings become their exact literal types) while still validating against `Cfg` — the idiomatic way to author a frozen, fully-typed, constraint-checked config object.",
    rubric: [
      "annotation validates but widens (loses precise inferred type)",
      "`as` only asserts — no validation, can hide errors",
      "satisfies validates AND preserves the narrow inferred type",
      "concrete example + `as const satisfies` for readonly literal config",
    ],
    hints: [
      "Which of the three checks the value but keeps the exact literal types?",
      "Think about whether `keyof typeof config` stays specific.",
    ],
  },
  {
    id: "ts-008",
    category: "typescript",
    level: "senior",
    title: "Compile-time types vs runtime validation",
    company: "Public API consumer",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your code does `const user = await res.json() as User;` against a third-party API. A teammate says 'we already have a `User` interface, so it's type-safe.' Explain why that is a false sense of safety and how a tool like zod changes the guarantee. What is the relationship between a zod schema and a TypeScript type?",
    idealAnswer:
      "`res.json()` returns `Promise<any>`, and `as User` is just an assertion — it tells the compiler to TRUST you, performing zero runtime checks. TypeScript types are fully erased at build time, so if the API returns a renamed field, a null where you expected a number, or an entirely different shape, nothing throws at the boundary; instead you get a `TypeError` or silently wrong data deep inside your app, far from the cause. The `User` interface only protects code you control, not data crossing a trust boundary. A runtime validator like zod closes the gap: you define a schema (`const User = z.object({ id: z.string(), age: z.number() })`) and call `User.parse(await res.json())`, which actually inspects the data at runtime and throws (or returns an error with `safeParse`) when it doesn't match — so bad data is caught AT the boundary with a clear message. The schema is the single source of truth: you derive the static type from it with `type User = z.infer<typeof User>`, so the compile-time type and the runtime check can never drift apart. Rule of thumb: trusted internal data needs only TS types; untrusted external data (HTTP, JSON, forms, env vars) needs runtime validation.",
    rubric: [
      "`as User` is an unchecked assertion; res.json() is any — no runtime check",
      "TS types are erased at runtime, so bad external data isn't caught at the boundary",
      "zod validates at runtime and throws/safeParses on mismatch",
      "z.infer keeps the static type and runtime schema in sync (single source of truth)",
    ],
    hints: [
      "What does `as` actually do at runtime? (nothing)",
      "Where do TypeScript types go after compilation?",
    ],
  },
  {
    id: "ts-009",
    category: "typescript",
    level: "mid",
    title: "Generic constraints with extends",
    company: "Utility library",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Write (prose/pseudocode) a type-safe `pluck<T, K>(items: T[], key: K): T[K][]` that extracts one property from each object in an array. What constraint must `K` have, and why does TypeScript reject the call if you don't constrain it? How does the return type stay precise?",
    idealAnswer:
      "The signature is `function pluck<T, K extends keyof T>(items: T[], key: K): T[K][]`. The constraint `K extends keyof T` is essential: it restricts `K` to only the actual property names of `T`, so `pluck(users, 'emial')` (typo) is a compile error rather than producing `undefined[]`. Without the constraint, `items[i][key]` would be indexing `T` with an arbitrary `K`, which TypeScript rejects because it can't prove `key` is a valid index of `T` (and even if allowed, the element type would be unknown/error). The return type stays precise because it's expressed as the indexed access type `T[K][]`: when you call `pluck(users, 'age')` and ages are numbers, `K` is inferred as the literal `'age'`, so `T['age']` resolves to `number` and the result is `number[]` — the compiler tracks the exact property type through the generic rather than collapsing to `any[]`. This is the canonical example of a generic constraint plus indexed access type working together for full type safety.",
    rubric: [
      "constraint `K extends keyof T` restricts key to real property names",
      "without it, indexing T by arbitrary K is rejected / typos slip through",
      "return type uses indexed access `T[K][]` to stay precise",
      "explains literal inference of K making T[K] a concrete type",
    ],
    hints: [
      "How do you say 'K must be one of T's keys'?",
      "What type operator gives you 'the type of property K on T'?",
    ],
  },
  {
    id: "ts-010",
    category: "typescript",
    level: "senior",
    title: "Mapped & utility types for a DTO",
    company: "CRM backend",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You have a domain `User` type and need: (a) a `CreateUserInput` that omits the server-generated `id` and `createdAt`, (b) an `UpdateUserInput` where every remaining field is optional, and (c) a read-only `PublicUser` that drops `passwordHash`. Express each using built-in utility types, and explain how `Partial`, `Pick`, `Omit`, and `Readonly` are implemented under the hood as mapped types.",
    idealAnswer:
      "Compose the built-ins: (a) `type CreateUserInput = Omit<User, 'id' | 'createdAt'>` removes the server-managed keys; (b) `type UpdateUserInput = Partial<Omit<User, 'id' | 'createdAt'>>` makes the remaining fields optional so a PATCH can send any subset; (c) `type PublicUser = Readonly<Omit<User, 'passwordHash'>>`. Under the hood these are all mapped types that iterate `[K in keyof T]`: `Partial<T>` is `{ [K in keyof T]?: T[K] }` (adds the optional `?` modifier), `Readonly<T>` is `{ readonly [K in keyof T]: T[K] }` (adds the `readonly` modifier), `Pick<T, K extends keyof T>` is `{ [P in K]: T[P] }` (iterates only the chosen keys), and `Omit<T, K>` is defined in terms of Pick as `Pick<T, Exclude<keyof T, K>>` (pick everything except K). Composing them keeps a single source of truth — when `User` gains a field, the derived DTOs update automatically — instead of hand-maintaining parallel interfaces that silently drift. Note `Omit` is structural and doesn't error on key names that aren't in `T` (a known sharp edge), whereas `Pick`'s keys are constrained to `keyof T`.",
    rubric: [
      "correct composition: Omit for create, Partial<Omit> for update, Readonly<Omit> for public",
      "Partial = optional modifier, Readonly = readonly modifier via `[K in keyof T]`",
      "Pick iterates chosen keys; Omit = Pick<T, Exclude<keyof T, K>>",
      "deriving DTOs from one source avoids drift",
    ],
    hints: [
      "Combine Omit with Partial / Readonly rather than redefining fields.",
      "Every one of these is `[K in keyof T]` with a modifier or key filter.",
    ],
  },
  {
    id: "ts-011",
    category: "typescript",
    level: "mid",
    title: "Bug hunt: the null the types allowed",
    company: "E-commerce",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "This compiles under `strict` but crashes in production with 'Cannot read properties of undefined'. Find the bug and explain the type-level mistake:\n\n    function getCity(user: User): string {\n      return user.address.city.toUpperCase();\n    }\n    // elsewhere:\n    const u = users.find(x => x.id === id);\n    console.log(getCity(u!));\n\nAssume `address` is optional on `User` (`address?: Address`).",
    idealAnswer:
      "There are two type-level mistakes. First, `address` is optional (`address?: Address`), so `user.address` is `Address | undefined`; `user.address.city` should be a compile error under `strict`. If it isn't erroring, someone has weakened the type — e.g. a non-null assertion `user.address!.city`, an `any` leak, or `strictNullChecks` is effectively off for that file — which suppresses the warning the compiler was trying to give. Second, `Array.prototype.find` returns `User | undefined`, but the caller uses `getCity(u!)` — the `!` non-null assertion tells the compiler 'trust me, it's not undefined' with zero runtime check, so when `find` returns `undefined` (no match) you pass `undefined` in and crash. The fix is to handle the absence honestly rather than asserting it away: narrow with a guard (`if (!u) return ...`) before calling, make `getCity` accept and check the optional chain (`user.address?.city?.toUpperCase() ?? fallback`), and avoid `!` except where you can genuinely prove non-null. The root lesson: `!` and `any` are how `undefined` sneaks past `strict` — they convert a compile error into a production crash.",
    rubric: [
      "address is optional so user.address.city should error; a `!`/any leak suppressed it",
      "Array.find returns T | undefined; `u!` asserts away the undefined with no check",
      "non-null assertion `!` performs no runtime check — that's the crash",
      "fix: narrow/guard or optional-chain + nullish coalescing instead of asserting",
    ],
    hints: [
      "What does `Array.prototype.find` return when nothing matches?",
      "What does the `!` operator actually verify at runtime?",
    ],
  },
  {
    id: "ts-012",
    category: "typescript",
    level: "senior",
    title: "Bug hunt: the any leak",
    company: "Internal tools",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A helper is meant to safely fetch typed JSON, but type safety silently vanishes downstream:\n\n    async function fetchJson(url: string) {\n      const res = await fetch(url);\n      return res.json(); // returns Promise<any>\n    }\n    const total: number = (await fetchJson('/cart')).items.length;\n\nExplain how `any` leaks here, why nothing errors, and how you'd redesign the helper to stop the leak.",
    idealAnswer:
      "`res.json()` is typed `Promise<any>`, so `fetchJson` has an inferred return type of `Promise<any>`. `any` is contagious: every expression derived from it is also `any`, so `(...).items.length` is `any`, and assigning `any` to `number` is allowed with no error even though `items` might not exist or `length` might be a string. The compiler isn't catching anything because `any` explicitly turns checking OFF for that whole chain — the safety didn't fail, it was opted out of. Redesign to stop the leak at the source. Minimal: make the helper generic and force the caller to supply the expected shape, returning `unknown` by default — `async function fetchJson<T = unknown>(url: string): Promise<T>` — so callers must narrow. Better: validate at the boundary with a schema, `async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> { return schema.parse(await (await fetch(url)).json()); }`, which both narrows the type AND checks the data at runtime, throwing on a bad response instead of letting `undefined` flow downstream. The principle: never let `any` escape a boundary function — terminate it with `unknown` + narrowing or a validator.",
    rubric: [
      "res.json() is Promise<any>, so fetchJson returns any and any is contagious",
      "assigning any to number is allowed — checking is opted out, not failing",
      "redesign: return unknown / generic T so callers must narrow",
      "best fix: validate at the boundary (zod schema.parse) for runtime + compile safety",
    ],
    hints: [
      "What is the declared return type of `res.json()`?",
      "How far does an `any` propagate through an expression chain?",
    ],
  },
  {
    id: "ts-013",
    category: "typescript",
    level: "mid",
    title: "Type guards & assertion functions",
    company: "Forms platform",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain user-defined type guards (`x is T`) and assertion functions (`asserts x is T`). Write a guard `isStringArray(x: unknown): x is string[]` and an assertion `assertDefined<T>(x: T | null | undefined): asserts x is T`. How do they differ in how they affect control flow and narrowing?",
    idealAnswer:
      "Both let YOU teach the compiler facts it can't infer, at a trust boundary. A user-defined type guard returns a boolean and has a return type predicate `x is T`: when it returns `true`, TypeScript narrows `x` to `T` in the branch that follows. Example: `function isStringArray(x: unknown): x is string[] { return Array.isArray(x) && x.every(e => typeof e === 'string'); }` — after `if (isStringArray(x))`, `x` is `string[]`. An assertion function returns `void` (or never returns) and is annotated `asserts x is T`: instead of branching, it THROWS if the condition fails, and TypeScript treats every line AFTER the call as having `x` narrowed to `T`. Example: `function assertDefined<T>(x: T | null | undefined, msg = 'expected value'): asserts x is T { if (x == null) throw new Error(msg); }` — after `assertDefined(user)`, `user` is `T` for the rest of the scope with no `if` needed. The key difference: a guard narrows within a conditional branch (you decide what to do with both outcomes), while an assertion narrows the rest of the current flow by eliminating the bad case via a throw. The danger with both is that the BODY is unchecked — if your guard's logic is wrong, you've lied to the compiler and reintroduced unsoundness, so the implementation must actually match the predicate.",
    rubric: [
      "type guard returns boolean with `x is T` predicate; narrows in the true branch",
      "assertion function returns void with `asserts x is T`; throws, narrows the rest of flow",
      "correct implementations for isStringArray and assertDefined",
      "warns the body is unchecked — a wrong guard reintroduces unsoundness",
    ],
    hints: [
      "One returns a boolean; the other throws and uses the `asserts` keyword.",
      "Where is `x` considered narrowed in each case?",
    ],
  },
  {
    id: "ts-014",
    category: "typescript",
    level: "senior",
    title: "Bug hunt: enum & == pitfalls",
    company: "Feature flags",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Review this and list the problems:\n\n    enum Role { Admin, Editor, Viewer }\n    function canEdit(role: Role, status) {\n      if (status == 'active' && role >= Role.Editor) return true;\n      return false;\n    }\n    const r: Role = 5;\n\nDiscuss the numeric-enum issues, the `==` vs `===`, the implicit `any`, and what you'd use instead of a numeric enum.",
    idealAnswer:
      "Several issues. (1) Numeric enums are not type-safe: `Role` is backed by numbers `0,1,2`, so `const r: Role = 5` COMPILES even though `5` is not a valid member — numeric enum types accept any number, which defeats the point. They also generate a reverse-mapping object and ordering like `role >= Role.Editor` relies on declaration order, which is fragile if someone reorders members. (2) `==` is loose equality with type coercion; `status == 'active'` should be `===` to avoid surprising coercions (and `status` could be anything). (3) `status` has no type annotation, so under `noImplicitAny` it's an error, and otherwise it's an implicit `any` that disables checking on that parameter — annotate it (`status: string` or a literal union `'active' | 'inactive'`). (4) Comparing roles with `>=` encodes a privilege hierarchy implicitly; better to make it explicit. Recommended replacement: a union of string literals (`type Role = 'admin' | 'editor' | 'viewer'`) or `const enum`/`as const` object — string-literal unions are exhaustively checkable, have no reverse-mapping or numeric-coercion footguns, can't accept an arbitrary value, and serialize readably. If you need ordering, define an explicit rank map rather than relying on enum numbering.",
    rubric: [
      "numeric enum accepts arbitrary numbers (`Role = 5` compiles) — not type-safe; relies on order",
      "`==` should be `===` to avoid coercion",
      "`status` is implicit any — must be annotated",
      "prefer string-literal union / as const object over numeric enum",
    ],
    hints: [
      "Try assigning a number that isn't a defined member to a numeric enum.",
      "Two separate equality/typing problems hide in the if condition.",
    ],
  },
  {
    id: "ts-015",
    category: "typescript",
    level: "senior",
    title: "Mutating a readonly array",
    company: "State management",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A reducer receives `state: readonly Item[]` (or `ReadonlyArray<Item>`) but a teammate writes `state.push(newItem); return state;` and is surprised it errors — then 'fixes' it with `(state as Item[]).push(newItem)`. Explain what `readonly`/`ReadonlyArray` guarantees, why the cast is dangerous, and the correct immutable update. Does `readonly` survive at runtime?",
    idealAnswer:
      "`ReadonlyArray<Item>` (a.k.a. `readonly Item[]`) is a COMPILE-TIME-only contract: it removes mutating methods (`push`, `pop`, `splice`, index assignment, `sort` in place) from the type, so `state.push(...)` correctly errors — the compiler is protecting the invariant that this array shouldn't be mutated (critical in reducers/React state where mutation causes stale-render and shared-reference bugs). The `(state as Item[]).push(...)` 'fix' is dangerous because the cast doesn't change anything at runtime — `readonly` is fully erased after compilation, the underlying object is a normal mutable array — so you are now mutating the original array in place, defeating the whole reason it was marked readonly and reintroducing exactly the shared-mutation bug the type was preventing. The correct fix is an immutable update that returns a NEW array: `return [...state, newItem];` (spread) or `return state.concat(newItem);`. To answer the runtime question directly: no, `readonly` does not survive at runtime — for true runtime immutability you'd need `Object.freeze`. The lesson is that casting away `readonly` is a code smell that almost always indicates you should be producing a new value, not mutating the old one.",
    rubric: [
      "ReadonlyArray/readonly removes mutating methods — a compile-time contract only",
      "the `as Item[]` cast erases the protection and mutates the original at runtime",
      "correct fix returns a NEW array (spread / concat), not in-place mutation",
      "readonly does not survive at runtime (use Object.freeze for that)",
    ],
    hints: [
      "Is `readonly` enforced by the JS engine or only by tsc?",
      "What should a reducer return instead of mutating its input?",
    ],
  },
  {
    id: "ts-016",
    category: "typescript",
    level: "senior",
    title: "Generic variance & function parameters",
    company: "Event system",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A teammate types an event handler registry like this and is confused why an unsafe assignment is allowed:\n\n    type Handler<T> = (event: T) => void;\n    let animalHandler: Handler<Animal>;\n    let dogHandler: Handler<Dog> = (d) => d.bark();\n    animalHandler = dogHandler; // allowed? and why is that a problem?\n\nExplain covariance vs contravariance for function parameters, why `strictFunctionTypes` matters here, and what actually goes wrong at runtime.",
    idealAnswer:
      "Function parameters are CONTRAVARIANT: a function is safely assignable to another only if its parameter type is the SAME or WIDER (a supertype), because the assigned function may be called with any value the target type allows. Here `animalHandler: Handler<Animal>` can be invoked with any `Animal` (say a `Cat`), but `dogHandler` expects a `Dog` and calls `d.bark()` — so `animalHandler = dogHandler` is UNSOUND: at runtime someone calls `animalHandler(cat)`, which runs `dogHandler`, which calls `cat.bark()` and explodes. The safe direction is the reverse: `dogHandler = animalHandler` (a handler that accepts any Animal can stand in where only Dogs are passed). `strictFunctionTypes` is what enforces this: with it ON, TypeScript checks function-TYPE parameters contravariantly and flags `animalHandler = dogHandler` as an error. The catch is that `strictFunctionTypes` does NOT apply to METHODS (methods are checked bivariantly for historical/ergonomic reasons like array methods), so writing the handler as a method signature `{ handle(event: T): void }` instead of a property `handle: (event: T) => void` silently loses the check. So the confusion usually traces to either `strictFunctionTypes` being off or the unsafe assignment happening through a method/bivariant position. Fix: keep `strict` on, model handlers as function-typed properties, and remember parameters go the opposite way from return types (which are covariant).",
    rubric: [
      "function parameters are contravariant — only assignable if param is same/wider",
      "explains the concrete runtime failure (cat.bark()) of the unsound direction",
      "strictFunctionTypes enables the contravariant check for function-typed params",
      "notes methods are checked bivariantly — the check is lost via method signatures",
    ],
    hints: [
      "If you assign dogHandler to animalHandler, what could animalHandler be called with?",
      "Methods and function-typed properties are NOT checked the same way.",
    ],
  },
];
