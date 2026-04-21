#!/usr/bin/env node

/**
 * Build script for Circle Addons
 * Uses esbuild for optimal bundling and minification
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const dotenv = require('dotenv');

const isDev = process.argv.includes('--dev');
const isProd = process.argv.includes('--prod') || (!isDev && !process.argv.includes('--watch'));

console.log(`\n🔨 Building Circle Addons...`);
console.log(`Mode: ${isDev ? 'Development' : 'Production'}\n`);

const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version || '0.0.0';

// Load build-time environment variables (local only; .env is gitignored).
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });

const WEB_ORIGIN =
  process.env.WEB_ORIGIN ||
  'https://web.staypost.app';

const CIRCLE_BASIS_POINTS_BASE_URL =
  process.env.CIRCLE_BASIS_POINTS_BASE_URL;

const CIRCLE_ADDONS_SCRIPTS_BASE_URL =
  process.env.CIRCLE_ADDONS_SCRIPTS_BASE_URL;

const CIRCLE_ADDONS_IMAGES_BASE_URL =
  process.env.CIRCLE_ADDONS_IMAGES_BASE_URL;

const CIRCLE_BLUECONIC_DOMAIN_KEY =
  process.env.CIRCLE_BLUECONIC_DOMAIN_KEY;

function requireEnv(name, value) {
  if (typeof value === 'string' && value.length > 0) return value;
  console.error(`❌ Missing required env var: ${name}`);
  console.error(`   Set it in .env or .env.local (both are gitignored).`);
  process.exit(1);
}

requireEnv('CIRCLE_BASIS_POINTS_BASE_URL', CIRCLE_BASIS_POINTS_BASE_URL);
requireEnv('CIRCLE_ADDONS_SCRIPTS_BASE_URL', CIRCLE_ADDONS_SCRIPTS_BASE_URL);
requireEnv('CIRCLE_ADDONS_IMAGES_BASE_URL', CIRCLE_ADDONS_IMAGES_BASE_URL);
requireEnv('CIRCLE_BLUECONIC_DOMAIN_KEY', CIRCLE_BLUECONIC_DOMAIN_KEY);

const checkoutPromosConfigPlugin = {
  name: 'checkout-promos-config',
  setup(build) {
    build.onResolve({ filter: /^@circle-config\/checkout-promos$/ }, () => {
      const privatePath = path.join(__dirname, 'config', 'checkout-promos.private.json');
      const publicPath = path.join(__dirname, 'config', 'checkout-promos.public.json');
      const chosen = fs.existsSync(privatePath) ? privatePath : publicPath;
      return { path: chosen };
    });
  }
};

const signupBrandingConfigPlugin = {
  name: 'signup-branding-config',
  setup(build) {
    build.onResolve({ filter: /^@circle-config\/signup-branding$/ }, () => {
      const privatePath = path.join(__dirname, 'config', 'signup-branding.private.json');
      const publicPath = path.join(__dirname, 'config', 'signup-branding.public.json');
      const chosen = fs.existsSync(privatePath) ? privatePath : publicPath;
      return { path: chosen };
    });
  }
};

/**
 * Plugin to minify HTML/CSS in template literals
 */
const htmlMinifierPlugin = {
  name: 'html-minifier',
  setup(build) {
    build.onEnd(async (result) => {
      if (build.initialOptions.minify && build.initialOptions.outfile) {
        const outfile = build.initialOptions.outfile;
        
        try {
          let code = fs.readFileSync(outfile, 'utf8');
          let originalSize = code.length;
          
          // Collect all replacements first to avoid position shifting
          const replacements = [];
          
          // Find all template literals that contain HTML (both innerHTML and variable assignments)
          // Match patterns like: innerHTML = `, let x = `, etc.
          const htmlPatterns = [
            /(innerHTML\s*=\s*)`([\s\S]*?)`/g,      // innerHTML assignments
            /((?:let|const|var)\s+\w+\s*=\s*)`([\s\S]*?<div[\s\S]*?)`/g  // Variables with HTML
          ];
          
          for (const regex of htmlPatterns) {
            let match;
            while ((match = regex.exec(code)) !== null) {
              const [fullMatch, prefix, html] = match;
              // Only process if it looks like HTML (contains < and >)
              if (html.includes('<') && html.includes('>')) {
                try {
                  const minified = await minify(html, {
                    collapseWhitespace: true,
                    removeComments: true,
                    minifyCSS: true,
                    minifyJS: false,
                    removeAttributeQuotes: false,
                    keepClosingSlash: true,
                    removeEmptyAttributes: false
                  });
                  replacements.push({
                    from: fullMatch,
                    to: `${prefix}\`${minified}\``
                  });
                } catch (e) {
                  console.warn(`   ⚠️  Could not minify HTML: ${e.message.substring(0, 50)}`);
                }
              }
            }
          }
          
          // Apply all replacements
          for (const { from, to } of replacements) {
            code = code.replace(from, to);
          }
          
          // Handle style.cssText (multiline)
          code = code.replace(/(\.cssText\s*=\s*)`([\s\S]*?)`/g, (match, prefix, css) => {
            const minifiedCss = css
              .replace(/\s+/g, ' ')
              .replace(/\s*([{}:;,])\s*/g, '$1')
              .replace(/;\s*}/g, '}')
              .trim();
            return `${prefix}\`${minifiedCss}\``;
          });
          
          fs.writeFileSync(outfile, code);
          let newSize = code.length;
          let saved = originalSize - newSize;
          console.log(`   ✨ HTML/CSS minified (${replacements.length} blocks, saved ${(saved / 1024).toFixed(2)} KB)`);
        } catch (error) {
          console.warn('   ⚠️  HTML minification failed:', error.message);
        }
      }
    });
  }
};

// Common build options
const commonOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['es2017'],
  platform: 'browser',
  format: 'iife',
  globalName: 'CircleAddons',
  plugins: [checkoutPromosConfigPlugin, signupBrandingConfigPlugin],
  define: {
    __WEB_ORIGIN__: JSON.stringify(WEB_ORIGIN)
    ,__CIRCLE_BASIS_POINTS_BASE_URL__: JSON.stringify(CIRCLE_BASIS_POINTS_BASE_URL)
    ,__CIRCLE_BLUECONIC_DOMAIN_KEY__: JSON.stringify(CIRCLE_BLUECONIC_DOMAIN_KEY)
    ,__CIRCLE_ADDONS_SCRIPTS_BASE_URL__: JSON.stringify(CIRCLE_ADDONS_SCRIPTS_BASE_URL)
    ,__CIRCLE_ADDONS_IMAGES_BASE_URL__: JSON.stringify(CIRCLE_ADDONS_IMAGES_BASE_URL)
  },
  banner: {
    js: `/**
 * Circle Addons v${version}
 * Bundled with esbuild
 * ${new Date().toISOString()}
 */`
  }
};

async function build() {
  try {
    // Development build (with source maps, not minified)
    if (isDev || !isProd) {
      console.log('📦 Building development version...');
      await esbuild.build({
        ...commonOptions,
        outfile: 'dist/circle-addons.js',
        minify: false,
        sourcemap: true,
        logLevel: 'info'
      });
      
      const devStats = fs.statSync('dist/circle-addons.js');
      console.log(`✅ Development build: ${(devStats.size / 1024).toFixed(2)} KB\n`);
    }
    
    // Production build (minified, no source maps)
    if (isProd || !isDev) {
      console.log('📦 Building production version...');
      await esbuild.build({
        ...commonOptions,
        outfile: 'dist/circle-addons.min.js',
        minify: true,
        sourcemap: false,
        logLevel: 'info',
        plugins: [htmlMinifierPlugin]
      });
      
      const prodStats = fs.statSync('dist/circle-addons.min.js');
      console.log(`✅ Production build: ${(prodStats.size / 1024).toFixed(2)} KB\n`);
    }
    
    console.log('🎉 Build completed successfully!\n');
    
    if (isProd || (!isDev && !isProd)) {
      console.log('📤 Upload to Circle.so:');
      console.log('   dist/circle-addons.min.js\n');
    }

    // Loader build (standalone file with env-inlined BASE URL)
    await esbuild.build({
      entryPoints: ['circle-addons-loader.js'],
      bundle: false,
      minify: false,
      platform: 'browser',
      target: ['es2017'],
      outfile: 'dist/circle-addons-loader.js',
      define: {
        __CIRCLE_ADDONS_SCRIPTS_BASE_URL__: JSON.stringify(CIRCLE_ADDONS_SCRIPTS_BASE_URL)
      },
      plugins: [checkoutPromosConfigPlugin, signupBrandingConfigPlugin],
      logLevel: 'silent'
    });
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();


