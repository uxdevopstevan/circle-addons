/**
 * Staypost SignUp Module
 * 
 * Customizes the sign-up page based on URL hash parameters.
 * Adds group-specific logos and headings to the Circle.so sign-up page.
 * 
 * Note: This module is called by page-scripts.js when on the sign-up page.
 */

import branding from '@circle-config/signup-branding';
import { debugLog, debugWarn } from './debug-logger.js';

/**
 * Initialize sign-up page customization
 * Assumes we're already on the sign-up page (routing handled by page-scripts.js)
 */
export function initSignUp() {
    debugLog('SignUp', 'Initializing...');
    
    const reactRoot = document.querySelector('#react-root');

    if (!reactRoot) {
        debugWarn('SignUp', 'reactRoot not found');
        return;
    }

    // This is the function that will run once the logo is found
    const executeLogic = (stayPostLogo) => {
        const heading = reactRoot.querySelector('h1');
        if (!heading) {
            debugWarn('SignUp', 'heading not found after logo was found.');
            return;
        }

        // Get group from URL hash parameters
        let group = null;
        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            group = hashParams.get('group');
        }

        let imageSrc = '';
        let imageAlt = '';

        const groups = (branding && branding.groups) ? branding.groups : {};
        const groupCfg = group && groups[group] ? groups[group] : null;

        if (groupCfg) {
            const imageBase = String(__CIRCLE_ADDONS_IMAGES_BASE_URL__ || '');

            if (groupCfg.heading) heading.textContent = groupCfg.heading;
            if (groupCfg.logo && groupCfg.logo.path) imageSrc = imageBase + groupCfg.logo.path;
            if (groupCfg.logo && groupCfg.logo.alt) imageAlt = groupCfg.logo.alt;
        }

        if (imageSrc) {
            const newImage = document.createElement('img');
            newImage.src = imageSrc;
            newImage.alt = imageAlt;
            newImage.classList.add('max-h-16', 'max-w-[14.375rem]', 'mt-5');
            
            if (stayPostLogo.parentNode) {
                stayPostLogo.parentNode.insertBefore(newImage, stayPostLogo.nextSibling);
                debugLog('SignUp', `New image added after logo for group: ${group || 'default'}`);
            }
        }
    };

    // --- Start of the MutationObserver logic ---
    
    // First, check if the logo is already there
    const initialLogo = reactRoot.querySelector('img');
    if (initialLogo) {
        debugLog('SignUp', 'Logo found immediately.');
        executeLogic(initialLogo);
        return;
    }
    
    // If not, set up an observer to watch for changes
    const observer = new MutationObserver((mutations, obs) => {
        const stayPostLogo = reactRoot.querySelector('img');
        if (stayPostLogo) {
            debugLog('SignUp', 'Logo found after a DOM mutation.');
            executeLogic(stayPostLogo);
            obs.disconnect(); // Stop observing once we've found it
        }
    });

    // Tell the observer to watch the #react-root element for new children
    observer.observe(reactRoot, {
        childList: true,
        subtree: true
    });
}

