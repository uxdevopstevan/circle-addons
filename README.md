# Circle Addons

A small JavaScript bundle for Circle.so's React-based platform.

It provides:
- Page-specific scripts (routed by URL)
- BlueConic profile sync (always-on for logged-in users)
- A shared profile API client for Circle internal endpoints

**Built with [ESBuild](https://esbuild.github.io/)** - Fast, modern JavaScript bundler with tree-shaking and optimization.

## 📁 File Structure

```
app/
├── src/                           # Source files (ES modules)
│   ├── index.js                   # Main entrypoint (auto-initializes)
│   ├── page-scripts.js            # URL router for page-specific features
│   ├── signup.js                  # Sign-up page UI tweaks
│   ├── blueconic.js               # BlueConic sync module (always-on)
│   ├── profile-api.js             # Shared Circle profile API helpers
│   ├── update-profile-fields.js   # Profile field sync + optional iframe submit
│   ├── checkout.js                # Checkout feature(s)
│   ├── checkout-promos.js         # Checkout page coupon feature(s)
│   ├── webcomponent.js            # <circle-widget> custom element
│   ├── debug-logger.js            # Optional in-page debug overlay
├── config/                        # Public/private JSON configs (private is gitignored)
│   ├── checkout-promos.public.json
│   ├── checkout-promos.private.json
│   ├── signup-branding.public.json
│   ├── signup-branding.private.json
│   ├── profile-field-sync.public.json
│   └── profile-field-sync.private.json
├── dist/                          # Build output ⭐ Upload to Circle.so / CDN
│   ├── circle-addons.js           # Dev build (sourcemap)
│   ├── circle-addons.min.js       # Prod build (minified)
│   └── circle-addons-loader.js    # Loader build (optional)
├── circle-addons-loader.js         # Loader source (built to dist/)
├── build.js                       # esbuild build script
├── package.json                   # Dependencies + build scripts
└── node_modules/                  # (ignored)
```

## 🚀 Quick Start

### For Production / Circle.so

Add just **ONE** script tag:

```html
<script src="https://your-cdn.com/circle-addons.min.js"></script>
```

The bundle auto-initializes on `DOMContentLoaded`.

### For Development / Testing

Use the development build with source maps:

```html
<script src="https://your-cdn.com/circle-addons.js"></script>
```

## 🔧 Configuration (build-time)

Configuration is loaded at build time (and inlined into `dist/` output) from:

1. `config/build.private.json` if present (gitignored)
2. otherwise `config/build.public.json`
3. `.env` / `.env.local` can override any value (also gitignored)

### Config files (public vs private)

This repo supports a **public/private JSON config** pattern:

- **Public config** files live in `config/*.public.json` and are safe to commit.
- **Private config** files live in `config/*.private.json` and should contain company-specific paths, coupon codes, endpoints, branding, etc. These are **gitignored**.

At build time (`build.js`), each config import automatically resolves to:
- `config/<name>.private.json` **if it exists locally**
- otherwise `config/<name>.public.json`

Current configs:
- **Checkout promos**: `config/checkout-promos.(public|private).json`
- **Sign-up branding**: `config/signup-branding.(public|private).json`
- **Profile field sync**: `config/profile-field-sync.(public|private).json`

#### Building a public artifact

1. Ensure private config files do not exist (or are renamed), e.g.:
   - `config/*\.private.json` should be absent
2. Build:

```bash
npm run build
```

The resulting `dist/circle-addons.min.js` will contain only the **public** dummy configs.

#### Building a private artifact

1. Create the private config files you need (they are gitignored):
   - `config/checkout-promos.private.json`
   - `config/signup-branding.private.json`
   - `config/profile-field-sync.private.json`
2. Build:

```bash
npm run build
```

The resulting `dist/circle-addons.min.js` will inline your **private** configs.

### Build settings

#### `WEB_ORIGIN`
**Used by**: `src/profile-api.js` (Circle internal API origin)

Set in `config/build.(public|private).json` as `webOrigin` (or override via `.env` as `WEB_ORIGIN`).

#### `CIRCLE_ADDONS_SCRIPTS_BASE_URL`
**Used by**: `circle-addons-loader.js` (base URL used to load versioned bundles)

Set in `config/build.(public|private).json` as `addonsScriptsBaseUrl` (or override via `.env` as `CIRCLE_ADDONS_SCRIPTS_BASE_URL`).

#### `CIRCLE_ADDONS_IMAGES_BASE_URL`
**Used by**: `src/signup.js` (base URL for group logo images)

Set in `config/build.(public|private).json` as `addonsImagesBaseUrl` (or override via `.env` as `CIRCLE_ADDONS_IMAGES_BASE_URL`).

#### `CIRCLE_BLUECONIC_DOMAIN_KEY`
**Used by**: `src/blueconic.js` (BlueConic property key prefix)

Set in `config/build.(public|private).json` as `blueconicDomainKey` (or override via `.env` as `CIRCLE_BLUECONIC_DOMAIN_KEY`).

Build output (`dist/`) inlines these values.

## 📦 Modules

### Sign-Up (`src/signup.js`)

Customizes the Circle.so sign-up page based on URL hash parameters.

- **What it does**: Reads `#group=<id>` from the URL hash, then updates the sign-up page heading and inserts a group logo.
- **Config**: `config/signup-branding.public.json` or `config/signup-branding.private.json`
- **Assets**: logo image URLs are built from `CIRCLE_ADDONS_IMAGES_BASE_URL` + the configured `logo.path`

**Usage:**
- Navigate to: `https://yoursite.circle.so/sign_up#group=example`
- The module will:
  - Detect the page
  - Read the `group` parameter
  - Add custom logo and heading

**Supported Groups:**
- `example` - Adds Example branding

### Page router (`src/page-scripts.js`)

Determines what features to run based on the current URL/path and initializes the relevant modules.

- **What it does**: Runs lightweight route checks (path/includes) and calls the correct initializer(s) for the current page.
- **Current routes**:
  - `/sign_up`: runs `initSignUp()`
  - `checkout` (path substring): runs `initCheckout()` + `initCheckoutPromos()`

### BlueConic (`src/blueconic.js`)

Always-on sync for logged-in users that maps Circle user/profile data into BlueConic profile properties.

 - **What it does**: Builds a BlueConic profile payload from `window.circleUser` and optional internal API lookups, then writes only changed values into BlueConic.
 - **Config**: `CIRCLE_BLUECONIC_DOMAIN_KEY` controls your property key prefix.

For debugging you can manually trigger a sync:

```js
window.circleAddons.modules.syncBlueConic();
```

### Profile API (`src/profile-api.js`)

Shared helpers for:
- Reading basic user data from `window.circleUser`
- Fetching profile/enhanced user data via Circle internal endpoints
- Updating profile fields (where permitted)

### Update profile fields (`src/update-profile-fields.js`)

Generic “profile field sync + optional iframe submit” flow.

- **What it does**:
  - Reads a configured profile custom field (and optional additional custom fields)
  - Lets the user fill missing values in a simple form
  - Persists the configured primary field back to the Circle profile
  - Submits a configurable set of querystring params to an external domain via a hidden iframe
  - Watches `postMessage` events from the iframe to switch UI states (loading/success)
- **Config**: `config/profile-field-sync.public.json` / `.private.json`

### Checkout (`src/checkout.js`)

Checkout enhancements that run on Circle checkout pages.

- **What it does**: Applies checkout-specific DOM/UX automation (e.g. selecting price options based on URL params).

### Checkout promos (`src/checkout-promos.js`)

Config-driven checkout promo questions and coupon application.

- **What it does**: On matching checkout paths, injects a small question UI and applies a configured coupon when the user selects the configured answer.
- **Config**: `config/checkout-promos.public.json` / `.private.json`

### Events (`src/events.js`)

Optional page enhancer for events pages.

- **What it does**: Updates specific event blocks/lists from inline config data, using MutationObserver to handle Circle’s React rendering.

### Web component (`src/webcomponent.js`)

Defines `<circle-widget>` for simple “drop-in” widgets.

- **What it does**: Registers a custom element, and renders a small Shadow DOM block showing current page/group info (primarily a scaffold for future widgets).

## 🔨 Development Workflow

### Build scripts

```bash
npm install          # Install dependencies
npm run build        # Builds dev + prod (and loader)
npm run build:dev    # Development build (with source maps)
npm run build:prod   # Production build (minified)
```

### Entry point

`src/index.js` auto-initializes and exposes a small debug API:

- `window.circleAddons.reinitialize()`
- `window.circleAddons.modules.*`

## 🐛 Debugging

### Debug overlay logger

Add `debug=1` (or `debug=true`) to enable the in-page debug overlay:

- `?debug=1`

Without `debug`, scripts stay silent (no `console.log` spam).

### Checkout verbose tracing

Checkout has an extra verbose flag for deep tracing:

- `?debug=1&checkout_debug=1`

### Loader: selecting a version

If you use `dist/circle-addons-loader.js`, you can load a specific versioned bundle with:

- `?debugVersion=v2` (or `?debugVersion=2`)

Notes:
- `debugVersion` controls **which bundle version** loads.
- `debug` controls the **on-page debug overlay**.

## 📝 Notes

