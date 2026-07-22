# iOS Handoff

## Build configuration

1. Copy `.env.production.example` to `.env.production`.
2. Set `VITE_API_BASE_URL` to the HTTPS Vercel deployment that serves the application API and Gemini proxy under `/api`.
3. Keep all provider keys in Vercel environment variables. Do not add provider keys to any `VITE_*` variable or to the iOS project.
4. Run `npm run ios:sync`, then `npm run ios:open` on a Mac.

## Xcode checklist

- Bundle ID: `app.lifekitchen.zhongzhong`
- Microphone permission text: configured in `ios/App/App/Info.plist`
- Test the todo, mix, reveal, login, and cellar flows on a physical device.
- Replace the current Capacitor placeholder App Icon and splash image with the approved production artwork before Archive/TestFlight.

## Backend contract

The iOS bundle prefixes its requests with `VITE_API_BASE_URL`:

- `/api/auth/*` for Supabase-backed email/password authentication
- `/api/llm/*` for the server-side Gemini proxy
- `/api/habits` and `/api/memories` for rhythm habits and daily memories
- `/api/*` for cellar, friends, reports, shares, and events

The API must permit the Capacitor iOS origin. `GEMINI_API_KEY` and Supabase service credentials stay in Vercel environment variables; the app bundle only receives `VITE_API_BASE_URL`.

Configure these server-side variables in Vercel (never prefix them with `VITE_`):

- `GEMINI_API_KEY` and optional `GEMINI_MODEL=gemini-flash-latest`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- `INVITE_ADMIN_KEY` for invite-code administration

Apply both SQL files under `supabase/migrations/` in filename order before the first production login. Habit summaries and daily review memories are stored in Supabase; no platform-provided memory is used.
