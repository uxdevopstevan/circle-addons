/**
 * Page-Specific Scripts Router
 * 
 * Central place to handle routing logic for page-specific functionality.
 * Checks the current URL and initializes appropriate page scripts.
 */

import { initSignUp } from './signup.js';
import { initUpdateProfileFields } from './update-profile-fields.js';
import { initCheckout } from './checkout.js';
import { initCheckoutPromos } from './checkout-promos.js';
// import { initDynamicEvents } from './events.js';

/**
 * Initialize page-specific scripts based on current URL
 */
export function initPageScripts() {
    console.log('Page Scripts: Checking current page...');
    
    const origin = window.location.origin;
    const path = window.location.pathname;
    const url = window.location.href;
    
    // Sign-up page
    if (url.includes(origin + '/sign_up')) {
        console.log('Page Scripts: Sign-up page detected, initializing sign-up module...');
        initSignUp();
    }
    
    // Basis points submission page
    if (url.includes('submit-basis-points')) {
        console.log('Page Scripts: Submit basis points page detected, initializing basis points module...');
        initUpdateProfileFields();
    }
    
    // General Checkout page (runs on all checkout pages including women-in-ag)
    if (path.includes('checkout')) {
        console.log('Page Scripts: Checkout page detected, initializing checkout module...');
        initCheckout();

        // Optional checkout promos (driven by config JSON)
        try {
            initCheckoutPromos();
        } catch (e) {
            console.warn('Page Scripts: Checkout promos failed to initialize', e);
        }
    }
    
    // Dynamic events page (featured / upcoming / past from events.json)
    // if (path.includes('dynamic-events')) {
    //     console.log('Page Scripts: Dynamic events page detected, initializing dynamicEvents module...');
    //     initDynamicEvents();
    // }
    
    // Add more page-specific scripts here as needed:
    // 
    // Profile page
    // if (path === '/profile') {
    //     console.log('Page Scripts: Profile page detected');
    //     initProfile();
    // }
    // 
    // Post pages
    // if (path.includes('/posts/')) {
    //     console.log('Page Scripts: Post page detected');
    //     initPostEnhancements();
    // }
    // 
    // Discussion pages
    // if (path.startsWith('/discussion')) {
    //     console.log('Page Scripts: Discussion page detected');
    //     initDiscussionFeatures();
    // }
    
    console.log('Page Scripts: Routing complete');
}

