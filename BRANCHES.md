# Release branches

## `main`: web production

- The Vite tavern lives in `tavern/`.
- `zhongzhongforever.net` must only be deployed from `main/tavern`.
- `data-collection/` remains the companion collection service.

## `ios`: Capacitor application

- The branch root is the iOS app workspace.
- Build it with `npm run ios:sync`, then open the generated project in Xcode.
- Do not run `vercel --prod` from this branch. The app calls the HTTPS API hosted by the web production project.

Shared product features must be ported deliberately to both branches. Platform packaging, native permissions, and safe-area changes belong only to `ios`.
