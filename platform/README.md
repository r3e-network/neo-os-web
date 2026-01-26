# Platform Layer (Host + Built-ins + Supabase)

This folder contains the **web host** (Next.js on Vercel), the **built-in Module Federation remote**, and the **Supabase Edge/RLS** components.
The MiniApp SDK source lives in `packages/@neo/uniapp-sdk` (published as `@r3e/uniapp-sdk`). The host injects `window.MiniAppSDK` from `platform/host-app/lib/miniapp-sdk`.

- `host-app/`: Next.js host application (iframe + Module Federation loader)
- `builtin-app/`: built-in MiniApps served via Module Federation
- `edge/`: Supabase Edge functions (auth/limits/routing)
- `rls/`: Supabase RLS SQL policies
