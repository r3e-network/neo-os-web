# Platform Layer (Host + SDK + Supabase)

This folder will contain the **web host** (Next.js on Vercel), the **MiniApp SDK**, and the **Supabase Edge/RLS** components.

- `host-app/`: Next.js host application (microfrontend/iframe embedding)
- `sdk/`: `window.MiniAppSDK` implementation
- `edge/`: Supabase Edge functions (auth/limits/routing)
- `rls/`: Supabase RLS SQL policies

