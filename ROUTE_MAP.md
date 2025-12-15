# Route Map - Kelly Homes App

## All Routes and Their URLs

### Main App Routes
- `/` → `app/page.tsx` (Landing page)
- `/auth` → `app/auth/page.tsx` (Auth page)
- `/auth/login` → `app/auth/login/page.tsx` (Login placeholder)
- `/auth/signup` → `app/auth/signup/page.tsx` (Signup placeholder)
- `/dashboard` → `app/dashboard/page.tsx` (User dashboard)
- `/catalog` → `app/catalog/page.tsx` (Furniture catalog)
- `/checkout` → `app/checkout/page.tsx` (Checkout)
- `/designers` → `app/designers/page.tsx` (Designer profiles)
- `/styles` → `app/styles/page.tsx` (Design styles)
- `/project/new` → `app/project/new/page.tsx` (New project)
- `/project/[id]` → `app/project/[id]/page.tsx` (Project view)

### Stitch Routes (Scoped Theme)
- `/stitch/welcome` → `app/stitch/welcome/page.tsx` ✅ **CANONICAL STITCH PAGE**

## Deprecated/Moved Files
- `app/_deprecated/welcome/page.tsx` (was `/welcome`)
- `app/_deprecated/(stitch)/welcome/page.tsx` (was route group version)

## Visual Confirmation
The canonical Stitch page at `/stitch/welcome` has a fixed green badge in the top-right corner that says "STITCH PAGE" to confirm you're viewing the correct file.

