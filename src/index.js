/**
 * Circle Addons - Main Entry Point
 * 
 * Bundles all functionality for Circle.so platform:
 * - Page-specific scripts (routed by URL)
 * - Always-on integrations (BlueConic)
 * - Always-on web components
 */

import { initPageScripts } from './page-scripts.js';
import { initBlueConic, syncBlueConic } from './blueconic.js';
// import { initWebComponent } from './webcomponent.js';

/**
 * Initialize all modules
 */
function initAll() {
    console.log('Circle Addons: Initializing all modules...');
    
    // Initialize page-specific scripts (handles routing internally)
    try {
        initPageScripts();
        console.log('Circle Addons: Page scripts initialized');
    } catch (error) {
        console.error('Circle Addons: Error initializing page scripts:', error);
    }
    
    // Initialize BlueConic integration (runs on all pages for logged-in users)
    try {
        initBlueConic();
        console.log('Circle Addons: BlueConic integration initialized');
    } catch (error) {
        console.error('Circle Addons: Error initializing BlueConic:', error);
    }
    
    // Initialize always-on web components
    // try {
    //     initWebComponent();
    //     console.log('Circle Addons: WebComponent module initialized');
    // } catch (error) {
    //     console.error('Circle Addons: Error initializing WebComponent module:', error);
    // }
    
    console.log('Circle Addons: All modules initialized successfully');
}

/**
 * Auto-initialize when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Document ready. Initialising Circle scripts...');
        initAll();
    });
} else {
    // DOM is already ready
    console.log('Document ready. Initialising Circle scripts...');
    initAll();
}

/**
 * Export public API for debugging/testing
 */
window.circleAddons = {
    version: '2.0.1',
    reinitialize: initAll,
    modules: {
        initPageScripts,
        initBlueConic,
        syncBlueConic
        // initWebComponent
    }
};

