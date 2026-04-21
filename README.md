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
│   ├── checkout-promos-config.js  # Checkout page coupon feature(s)
│   ├── checkout-promos.js         # Checkout page coupon feature(s)
│   └── events.js                  # (Optional) events page logic
├── dist/                          # Build output ⭐ Upload to Circle.so / CDN
│   ├── circle-addons.js           # Dev build (sourcemap)
│   ├── circle-addons.min.js       # Prod build (minified)
│   └── circle-addons-loader.js    # Loader build (optional)
├── build.js                       # esbuild build script
├── package.json                   # Dependencies + build scripts
├── blueconic/                     # Legacy/notes/scripts
└── signup-script/                 # Legacy scripts kept for reference
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

All configuration is read from `.env` / `.env.local` at build time and inlined into `dist/` output.

### Required env vars

#### `WEB_ORIGIN`
- **Used by**: `src/profile-api.js` (Circle internal API origin)
- **Example**:

```bash
WEB_ORIGIN=https://yoursite.circle.so
```

#### `CIRCLE_BASIS_POINTS_BASE_URL`
- **Used by**: `src/update-profile-fields.js` (iframe form endpoint)
- **Example**:

```bash
CIRCLE_BASIS_POINTS_BASE_URL=https://example.com/submit_basis_points
```

#### `CIRCLE_ADDONS_SCRIPTS_BASE_URL`
- **Used by**: `circle-addons-loader.js` (base URL used to load versioned bundles)
- **Example**:

```bash
CIRCLE_ADDONS_SCRIPTS_BASE_URL=https://your-cdn.com/assets/scripts/circle/
```

#### `CIRCLE_ADDONS_IMAGES_BASE_URL`
- **Used by**: `src/signup.js` (base URL for group logo images)
- **Example**:

```bash
CIRCLE_ADDONS_IMAGES_BASE_URL=https://your-cdn.com/assets/images/circle/
```

#### `CIRCLE_BLUECONIC_DOMAIN_KEY`
- **Used by**: `src/blueconic.js` (BlueConic property key prefix)
- **Example**:

```bash
CIRCLE_BLUECONIC_DOMAIN_KEY=your_domain_key_
```

Build output (`dist/`) inlines these values, so runtime does not need a `.env`.

## 📦 Modules

### Sign-Up (`src/signup.js`)

Customizes the Circle.so sign-up page based on URL hash parameters.

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

### BlueConic (`src/blueconic.js`)

Always-on sync for logged-in users that maps Circle user/profile data into BlueConic profile properties.

For debugging you can manually trigger a sync:

```js
window.circleAddons.modules.syncBlueConic();
```

### Profile API (`src/profile-api.js`)

Shared helpers for:
- Reading basic user data from `window.circleUser`
- Fetching profile/enhanced user data via Circle internal endpoints
- Updating profile fields (where permitted)

## 🔨 Development Workflow

### Build scripts

```bash
npm install          # Install dependencies
npm run build        # Production build (minified)
npm run build:dev    # Development build (with source maps)
npm run build:prod   # Same as build (explicit)
```

### Entry point

`src/index.js` auto-initializes and exposes a small debug API:

- `window.circleAddons.reinitialize()`
- `window.circleAddons.modules.*`

## 🐛 Debugging

Open your browser devtools console; modules log verbosely on init and on key actions.

## 📝 Notes

