# Project 2 Technical & Interview Guide: NexusPulse
**Full Title:** NexusPulse: Full-Stack Enterprise Analytics & SaaS Web Platform  
**Author:** Mohamed Seddik Feki  
**Tech Stack:** Next.js 14 (SSR), React 18, TypeScript, Node.js, Tailwind CSS, GraphQL, JWT / RBAC  
**Project Folder:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\nexus-pulse-saas\`  
**Live Interactive Simulator:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\nexus-pulse-saas\demo\index.html`

---

## 1. The 30-Second Elevator Pitch (What to Say in Interviews)
> *"NexusPulse is a full-stack enterprise observability and SaaS analytics platform I built with Next.js, TypeScript, Tailwind CSS, and GraphQL. It solves three main engineering challenges: first, it renders 50,000 to 100,000+ live time-series data points at a locked 60 FPS without browser DOM lag by combining HTML5 Canvas with the Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm; second, it enforces 3-tier Role-Based Access Control (Admin, Engineer, Viewer) across both the UI and GraphQL resolvers; and third, it implements stateful JWT Refresh Token Rotation with Token Family Replay Detection to immediately neutralize stolen refresh tokens."*

---

## 2. Core Engineering Problems Solved

### Problem A: Rendering 50,000+ Data Points at 60 FPS Without Freezing the Browser
* **The Challenge:** Standard SVG chart libraries create one DOM node (`<circle>` or `<path>` segment) per data point. At 50,000+ points, the browser DOM tree bloats, causing multi-second freezes and dropping frame rates below 5 FPS.
* **Your Solution (`src/lib/timeseries-engine.ts`):**
  1. **Ring-Buffer Memory Storage:** Raw telemetry points (`timestamp`, `value`, `latencyMs`, `anomalyScore`) are stored in an in-memory ring buffer so memory usage stays strictly bounded.
  2. **Largest-Triangle-Three-Buckets (LTTB) Downsampling:** Before rendering a frame on the HTML5 `<canvas>`, we run the $O(N)$ LTTB decimation algorithm to reduce 50,000+ points down to $K$ visual buckets (e.g., 500 buckets matching the canvas pixel width) in **under 1.5 milliseconds**.
  3. **How LTTB Preserves Spikes Mathematically:** For each bucket, LTTB calculates the area of a triangle formed by:
     $$\text{Area} = \frac{1}{2} \left| (x_A - x_C)(y_B - y_A) - (x_A - x_B)(y_C - y_A) \right|$$
     where $A$ is the previously selected point, $B$ is a candidate point in the current bucket, and $C$ is the centroid (average) of the next bucket. The point $B$ that maximizes the triangle area is selected—guaranteeing that every visual peak, trough, and server anomaly spike is preserved on screen!

### Problem B: Granular Role-Based Access Control (RBAC)
* **The Challenge:** Enterprise SaaS dashboards are used by different teams—DevOps Admins, Site Reliability Engineers, and External Auditors/Viewers. Lower-privileged users must not be able to execute destructive mutations (like purging cluster caches or rotating tenant keys).
* **Your Solution (`src/lib/rbac-jwt.ts` & `src/graphql/schema.ts`):**
  - Defined a 3-tier permission matrix across **13 distinct permission scopes**:
    - **`ADMIN` (13 scopes):** Full read/write access, cluster node restarts, global cache purge, and security token management.
    - **`ENGINEER` (8 scopes):** Can view telemetry, run LTTB downsampling queries, and restart degraded edge nodes, but blocked (`403 Forbidden`) from purging global caches or modifying tenant security.
    - **`VIEWER` (3 scopes):** Strictly read-only access to dashboards and metrics; all mutation controls are visually masked in the UI and rejected at the GraphQL resolver layer.

### Problem C: Preventing Stolen Refresh Token Replay Attacks
* **The Challenge:** If an attacker intercepts a user's Refresh Token, they could try to mint new Access Tokens indefinitely.
* **Your Solution (`src/lib/rbac-jwt.ts` — Stateful Token Family Rotation):**
  - Every login session creates a **Token Family (`familyId`)** starting at `version = 1`.
  - Whenever `rotateTokenPair()` is called, the server issues `version = 2` and invalidates `version = 1`.
  - **Replay Attack Detection:** If an attacker attempts to reuse an older token (`packet.version < currentFamilyVersion`), the engine immediately detects a **Token Replay Breach** and **revokes the entire `familyId`**, locking out both the attacker and the compromised session immediately.

---

## 3. Key Files in Your Repository
| File Path | What It Does |
|-----------|--------------|
| `projects/nexus-pulse-saas/src/lib/timeseries-engine.ts` | 50,000+ point ring buffer, $O(N)$ LTTB downsampling algorithm, and P95/P99 percentile statistics calculator. |
| `projects/nexus-pulse-saas/src/lib/rbac-jwt.ts` | 3-tier RBAC permission engine, HMAC-SHA256 JWT signing/verification, and stateful token family rotation with replay detection. |
| `projects/nexus-pulse-saas/src/graphql/schema.ts` | GraphQL SDL schema (`typeDefs`), resolvers (`getTelemetry`, `getClusterHealth`, `restartNode`, `switchRole`, `rotateTokens`), and query executor. |
| `projects/nexus-pulse-saas/src/app/page.tsx` | Next.js 14 Server-Side Rendered (SSR) analytics dashboard component with KPI cards and RBAC gates. |
| `projects/nexus-pulse-saas/demo/index.html` | Standalone interactive SaaS dashboard with 50k/100k 60 FPS canvas chart, live RBAC switcher, JWT replay attack simulator, GraphQL playground, and TypeScript code viewer. |
| `test/nexus-pulse-project.test.js` | 35 automated unit & integration tests verifying LTTB accuracy, RBAC enforcement, JWT replay revocation, and GraphQL execution. |

---

## 4. Common Technical Interview Questions & Your Answers

**Q1: "Why did you choose LTTB downsampling instead of simple average bucketing or taking every $N$-th point?"**  
> **Your Answer:** *"If you take every $N$-th point (nyquist sampling) or average a bucket of 100 points, a sudden 1-second server latency spike of 900ms gets averaged out and disappears from the chart! LTTB maximizes the effective triangle area between adjacent buckets, which mathematically locks onto local extrema (peaks and valleys). So an engineer looking at the 500-point downsampled canvas still sees every single anomaly spike from the 50,000 raw data points, while rendering in under 1.5 milliseconds at 60 FPS."*

**Q2: "How does your JWT Refresh Token Rotation detect a stolen token?"**  
> **Your Answer:** *"Each refresh token belongs to a `familyId` and carries a monotonically increasing `version` integer. When a legitimate client refreshes `v1` to get `v2`, the server updates the family's active version to `2`. If a stolen `v1` token is replayed later, the server sees `token.version (1) < family.currentVersion (2)`, flags a replay attack, and immediately revokes the entire `familyId` so neither token can be used."*
