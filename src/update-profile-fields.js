/**
 * Profile Field Sync Module
 * 
 * Generic helper to:
 * - read/update a configured profile custom field
 * - optionally submit a set of form fields to an external domain via a hidden iframe
 * 
 * Config comes from @circle-config/profile-field-sync (public/private JSON).
 */

// Import shared profile API utilities
import { getCurrentUserPublicUid, getUserData, getProfileData, updateCustomField } from './profile-api.js';
import rootCfg from '@circle-config/profile-field-sync';

import { initDebugLogger, debugError, debugLog, debugSuccess, debugWarn } from './debug-logger.js';

function normalizeSetups(cfg) {
    if (!cfg) return [];

    // v2: { enabled, setups: [...] }
    if (Array.isArray(cfg.setups)) {
        const enabled = cfg.enabled !== false;
        if (!enabled) return [];
        return cfg.setups.filter(Boolean);
    }

    // v1 (legacy): single object
    return [cfg];
}

function setupIsEnabled(setup) {
    if (!setup) return false;
    return setup.enabled !== false;
}

function setupMatchesPath(setup) {
    const match = setup && setup.match ? setup.match : {};
    const path = window.location.pathname || '';
    if (typeof match.pathIncludes === 'string' && match.pathIncludes.length > 0) {
        return path.includes(match.pathIncludes);
    }
    return true;
}

function setupCategory(setup) {
    const id = setup && setup.id ? String(setup.id) : '';
    return id ? `Profile Field Sync:${id}` : 'Profile Field Sync';
}

/**
 * Extract UTM parameters from current URL
 * @returns {Object} UTM parameters (source, medium, campaign)
 */
function getUtmParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        utm_source: urlParams.get('utm_source') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        utm_campaign: urlParams.get('utm_campaign') || ''
    };
}

/**
 * Extract course_name parameter from current URL
 * @returns {string} Course name or empty string
 */
function getCourseName() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('course_name') || '';
}

/**
 * Extract registration_claim parameter from current URL
 * @returns {boolean} True if registration_claim=true in URL
 */
function getRegistrationClaim() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('registration_claim') === 'true';
}

/**
 * Get the formWrapper element
 * @returns {HTMLElement|null}
 */
function getWrapper(setup, category) {
    const wrapperId = (setup && setup.dom && setup.dom.wrapperId) ? setup.dom.wrapperId : 'profileFieldSyncWrapper';
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) {
        debugError(category || 'Profile Field Sync', `${wrapperId} div not found`);
    }
    return wrapper;
}

function shouldRunSetup(setup) {
    return setupIsEnabled(setup) && setupMatchesPath(setup);
}

/**
 * Create and load hidden iframe with form submission
 * @param {{email?: string, firstName?: string, lastName?: string}} userData - User data for submission
 * @param {string} fieldValue - Field value
 */
function getUrlParam(name) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name) || '';
    } catch (e) {
        return '';
    }
}

function resolveSubmitFieldValue(from, context) {
    if (!from) return '';

    if (from === 'fieldValue') return context.fieldValue || '';
    if (from === 'user.email') return context.userData.email || '';
    if (from === 'user.firstName') return context.userData.firstName || '';
    if (from === 'user.lastName') return context.userData.lastName || '';

    if (from.startsWith('profile.')) {
        const key = from.slice('profile.'.length);
        const customFields = context.customFields || {};
        return (key && Object.prototype.hasOwnProperty.call(customFields, key)) ? (customFields[key] || '') : '';
    }

    if (from.startsWith('url.')) {
        const key = from.slice('url.'.length);
        // Keep existing semantics for booleans:
        // registration_claim was previously included only when "true".
        if (key === 'registration_claim') return getRegistrationClaim() ? 'true' : '';
        return getUrlParam(key);
    }

    return '';
}

function createHiddenIframe(setup, category, userData, fieldValue, customFields) {
    // Set up message listener for iframe communication
    setupMessageListener(setup, category);
    
    // Build URL with parameters
    const baseUrl = setup && setup.submit && setup.submit.baseUrl;
    if (!baseUrl) {
        debugError(category || 'Profile Field Sync', 'Missing submit.baseUrl in config');
        return;
    }
    const params = new URLSearchParams();

    const ctx = { userData: userData || {}, fieldValue, customFields: customFields || {} };

    // New config format: submit.fields[]
    if (setup && setup.submit && Array.isArray(setup.submit.fields)) {
        for (const f of setup.submit.fields) {
            if (!f || typeof f.name !== 'string') continue;
            const val = resolveSubmitFieldValue(f.from, ctx);
            if (val) {
                params.append(f.name, val);
            } else if (!f.optional) {
                // If it's required but empty, still append empty to preserve contract.
                params.append(f.name, '');
            }
        }
    } else {
        // Backward-compatible: submit.params + include* flags
        const paramsCfg = (setup && setup.submit && setup.submit.params) ? setup.submit.params : {};
        params.append(paramsCfg.email || 'email', (userData && userData.email) || '');
        params.append(paramsCfg.firstName || 'firstName', (userData && userData.firstName) || '');
        params.append(paramsCfg.lastName || 'lastName', (userData && userData.lastName) || '');
        params.append(paramsCfg.fieldValue || 'value', fieldValue);
    }

    // Cache-busting timestamp (optional)
    if (!setup || !setup.submit || setup.submit.includeTimestampParam !== false) {
        const name = (setup && setup.submit && setup.submit.timestampParamName) ? setup.submit.timestampParamName : '_t';
        params.append(name, String(Date.now()));
    }
    
    // Backward-compatible extras (only if NOT using submit.fields[])
    const usingFields = setup && setup.submit && Array.isArray(setup.submit.fields);
    if (!usingFields) {
        // Add UTM parameters if present
        if (!setup || !setup.submit || setup.submit.includeUtm !== false) {
            const utmParams = getUtmParams();
            if (utmParams.utm_source) params.append('utm_source', utmParams.utm_source);
            if (utmParams.utm_medium) params.append('utm_medium', utmParams.utm_medium);
            if (utmParams.utm_campaign) params.append('utm_campaign', utmParams.utm_campaign);
        }
        
        // Add course_name if present
        if (!setup || !setup.submit || setup.submit.includeCourseName !== false) {
            const courseName = getCourseName();
            if (courseName) params.append('course_name', courseName);
        }
        
        // Add registration_claim if true
        if (!setup || !setup.submit || setup.submit.includeRegistrationClaim !== false) {
            const registrationClaim = getRegistrationClaim();
            if (registrationClaim) params.append('registration_claim', 'true');
        }
    }
    
    const iframeUrl = `${baseUrl}?${params.toString()}`;
    
    const firstName = (userData && userData.firstName) ? String(userData.firstName) : '';
    const lastName = (userData && userData.lastName) ? String(userData.lastName) : '';
    const displayName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : '(no name)';
    debugLog(category || 'Profile Field Sync', `Loading iframe with URL: ${iframeUrl}`);
    
    // Show loading state
    showLoadingState(setup, category);
    
    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.style.cssText = `
        position: absolute;
        width: 0;
        height: 0;
        border: none;
        display: none;
        visibility: hidden;
    `;
    iframe.title = (setup && setup.profile && setup.profile.label) ? `Submit ${setup.profile.label}` : 'Submit';
    
    // Add to body (hidden from user)
    document.body.appendChild(iframe);
}

/**
 * Get configured field value from profile
 * Uses the shared profile API module
 * @returns {Promise<string|null>} The field value or null
 */
async function getFieldValue(setup, category) {
    const profileResponse = await getProfileData();
    
    if (!profileResponse || !profileResponse.customFields) {
        debugError(category || 'Profile Field Sync', 'Cannot get field value: Profile data not available');
        debugError(category || 'Profile Field Sync', 'Profile data not available');
        return null;
    }

    try {
        const keys = Object.keys(profileResponse.customFields || {}).sort();
        debugLog(category || 'Profile Field Sync', `Available customFields (${keys.length}): ${keys.join(', ')}`);
    } catch (e) {}
    
    const fieldKey = setup && setup.profile && setup.profile.fieldKey;
    const value = fieldKey ? (profileResponse.customFields[fieldKey] || null) : null;
    
    if (value) {
        const label = (setup && setup.profile && setup.profile.label) ? setup.profile.label : fieldKey || 'field';
        debugLog(category || 'Profile Field Sync', `${label} found: ${value}`);
    }
    
    return value;
}

async function getProfileCustomFields(category) {
    const profileResponse = await getProfileData();
    if (!profileResponse || !profileResponse.customFields) return {};
    try {
        const keys = Object.keys(profileResponse.customFields || {}).sort();
        debugLog(category || 'Profile Field Sync', `Loaded customFields for submit (${keys.length})`);
    } catch (e) {}
    return profileResponse.customFields || {};
}

/**
 * Update the user's configured field in their profile
 * Uses the shared profile API module
 * @param {string} newValue - The new field value to save
 * @returns {Promise<boolean>} True if successful
 */
async function updateProfileField(setup, category, newValue) {
    const fieldKey = setup && setup.profile && setup.profile.fieldKey;
    if (!fieldKey) return false;
    debugLog(category || 'Profile Field Sync', `Updating profile field ${fieldKey}: ${newValue}`);
    debugLog(category || 'Profile Field Sync', `Updating profile field: ${fieldKey}`);
    
    // Use the shared updateCustomField function from profile-api
    const success = await updateCustomField(fieldKey, newValue);
    
    if (success) {
        debugSuccess(category || 'Profile Field Sync', 'Profile updated successfully!');
    } else {
        debugError(category || 'Profile Field Sync', 'Profile update failed');
        debugError(category || 'Profile Field Sync', 'Profile update failed');
    }
    
    return success;
}

/**
 * Show loading state
 */
function showLoadingState(setup, category) {
    const wrapper = getWrapper(setup, category);
    if (!wrapper) return;
    
    wrapper.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-8 text-center max-w-md mx-auto">
            <div class="mb-4">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">${(setup && setup.ui && setup.ui.loadingTitle) ? setup.ui.loadingTitle : 'Submitting'}</h3>
            <p class="text-gray-600">${(setup && setup.ui && setup.ui.loadingBody) ? setup.ui.loadingBody : 'Please wait while we process your submission...'}</p>
        </div>
    `;
    
    debugLog(category || 'Profile Field Sync', 'Showing loading state');
}

/**
 * Show success state
 */
function showSuccessState(setup, category) {
    const wrapper = getWrapper(setup, category);
    if (!wrapper) return;
    
    wrapper.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-8 text-center max-w-md mx-auto">
            <div class="mb-4">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                    <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
            </div>
            <h3 class="text-2xl font-bold text-green-600 mb-3">Success!</h3>
            <p class="text-lg text-gray-800 mb-2">Thank you for your submission.</p>
            <p class="text-gray-600">Your details have been successfully submitted to our database.</p>
        </div>
    `;
    
debugSuccess(category || 'Profile Field Sync', 'Showing success state');
}

let globalMessageListenerSetup = false;
const messageListenerRegistry = new Map(); // key -> { setup, category }

function setupMessageListener(setup, category) {
    const key = (setup && setup.id) ? String(setup.id) : ((setup && setup.dom && setup.dom.wrapperId) ? String(setup.dom.wrapperId) : 'default');

    if (messageListenerRegistry.has(key)) {
        debugLog(category || 'Profile Field Sync', 'Message listener already setup, skipping');
        return;
    }
    messageListenerRegistry.set(key, { setup, category });

    if (globalMessageListenerSetup) return;
    globalMessageListenerSetup = true;

    window.addEventListener('message', (event) => {
        if (!event || !event.data || !event.data.type) return;
        const type = event.data.type;

        for (const { setup: s, category: cat } of messageListenerRegistry.values()) {
            const submittingType = (s && s.messages && s.messages.submittingType) ? s.messages.submittingType : 'FORM_SUBMITTING';
            const successType = (s && s.messages && s.messages.successType) ? s.messages.successType : 'FORM_SUCCESS';
            const successFlagKey = (s && s.messages && s.messages.successFlagKey) ? s.messages.successFlagKey : 'success';

            if (type !== submittingType && type !== successType) continue;

            debugLog(cat || 'Profile Field Sync', `Received message: ${type}`);
            debugLog(cat || 'Profile Field Sync', `Received message: ${JSON.stringify(event.data)}`);

            if (type === submittingType) {
                showLoadingState(s, cat);
            } else if (type === successType && (!successFlagKey || event.data[successFlagKey])) {
                showSuccessState(s, cat);
            }
        }
    });
}

/**
 * Save configured field to profile and load iframe
 * @param {string} fieldValue - field value to save
 * @param {string} firstName - First name for submission
 * @param {string} lastName - Last name for submission
 * @param {HTMLElement} submitBtn - Optional submit button to show loading state
 */
async function saveFieldAndSubmit(setup, category, fieldValue, firstName, lastName, submitBtn = null) {
    debugLog(category || 'Profile Field Sync', `Submitting - First: ${firstName}, Last: ${lastName}`);
    
    // Show button loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }
    
    const fieldLabel = (setup && setup.profile && setup.profile.label) ? setup.profile.label : 'field';
    debugLog(category || 'Profile Field Sync', `Saving ${fieldLabel} to profile (name not saved)...`);
    const updateSuccess = await updateProfileField(setup, category, fieldValue);
    
    if (updateSuccess) {
        debugSuccess(category || 'Profile Field Sync', `${fieldLabel} saved to profile!`);
    } else {
        debugWarn(category || 'Profile Field Sync', 'Could not save to profile, but continuing with submission');
    }
    
    // Load iframe with data
    const userData = getUserData();
    const customFields = await getProfileCustomFields(category);
    createHiddenIframe(setup, category, userData, fieldValue, customFields);
}

/**
 * Load iframe using data from user profile
 * @param {string} fieldValue - The field value
 */
async function loadIframe(setup, category, fieldValue) {
    const userData = getUserData();
    const customFields = await getProfileCustomFields(category);
    createHiddenIframe(setup, category, userData, fieldValue, customFields);
}

/**
 * Show not logged in message
 */
function showNotLoggedInMessage(setup, category) {
    const wrapper = getWrapper(setup, category);
    if (!wrapper) return;
    
    debugWarn(category || 'Profile Field Sync', 'User not logged in');
    
    wrapper.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-8 text-center max-w-md mx-auto">
            <div class="mb-4">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full">
                    <svg class="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
            </div>
            <h3 class="text-2xl font-bold text-gray-800 mb-3">Please Log In</h3>
            <p class="text-lg text-gray-700 mb-4">You need to be logged in to continue.</p>
            <p class="text-sm text-gray-600 mb-6">Sign in to your Circle account to continue.</p>
            <a 
                href="/users/sign_in" 
                style="background-color: black"
                class="inline-block text-white font-medium py-3 px-6 rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
                Sign In to Continue
            </a>
        </div>
    `;
}

/**
 * Show simple field form (when user has first/last name)
 * @param {string} existingValue - Existing field value if found
 */
function showFieldOnlyForm(setup, category, existingValue = '') {
    const wrapper = getWrapper(setup, category);
    if (!wrapper) return;
    
    const fieldLabel = (setup && setup.profile && setup.profile.label) ? setup.profile.label : 'ID';
    debugLog(category || 'Profile Field Sync', `Showing ${fieldLabel} form (user has name)`);
    
    const formHtml = `
        <div class="bg-white rounded-lg p-6 max-w-md mx-auto">
            <div class="mb-6">
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Enter Your ${fieldLabel}</h3>
                <p class="text-sm text-gray-600">Please enter your ${fieldLabel} below to continue.</p>
            </div>
            
            <form id="circleFieldSimpleForm" class="space-y-4">
                <div>
                    <label for="circleFieldInput" class="block text-sm font-medium text-gray-700 mb-1">
                        ${fieldLabel} <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="circleFieldInput" 
                        name="circleField" 
                        required
                        value="${existingValue}"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Enter your ID"
                    />
                </div>
                
                <button 
                    type="submit"
                    style="background-color: black" 
                    class="w-full text-white font-medium py-2 px-4 rounded-md transition duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                    Submit
                </button>
            </form>
            
            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p class="text-xs text-blue-800">
                    💡 <strong>Tip:</strong> This value will be saved to your profile for future auto-fill.
                </p>
            </div>
        </div>
    `;
    
    wrapper.innerHTML = formHtml;
    
    // Add form submit handler
    const form = document.getElementById('circleFieldSimpleForm');
    if (form) {
        setupMessageListener(setup, category);
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fieldValue = document.getElementById('circleFieldInput').value.trim();
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!fieldValue) {
                debugWarn(category || 'Profile Field Sync', `${fieldLabel} is required`);
                alert(`Please enter your ${fieldLabel}`);
                return;
            }
            
            // Get names from profile
            const userData = getUserData();
            
            // Save and submit
            await saveFieldAndSubmit(setup, category, fieldValue, userData.firstName, userData.lastName, submitBtn);
        });
    }
}

/**
 * Show complete form when user data is missing (first/last name or field value)
 * @param {string} existingValue - Existing field value if found
 * @param {string} existingFirstName - Existing first name if found
 * @param {string} existingLastName - Existing last name if found
 */
function showCompleteDataForm(setup, category, existingValue = '', existingFirstName = '', existingLastName = '') {
    const wrapper = getWrapper(setup, category);
    if (!wrapper) return;
    
    const fieldLabel = (setup && setup.profile && setup.profile.label) ? setup.profile.label : 'ID';
    debugLog(category || 'Profile Field Sync', `Showing complete data form (missing first/last name and/or ${fieldLabel})`);
    
    // Create form HTML with Tailwind classes
    const formHtml = `
        <div class="bg-white rounded-lg p-6 max-w-md mx-auto">
            <div class="mb-6">
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Complete Your Details</h3>
                <p class="text-sm text-gray-600">Please provide the following information to continue.</p>
            </div>
            
            <form id="completeForm" class="space-y-4">
                <div>
                    <label for="firstNameInput" class="block text-sm font-medium text-gray-700 mb-1">
                        First Name <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="firstNameInput" 
                        name="firstName" 
                        required
                        value="${existingFirstName}"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Enter your first name"
                    />
                </div>
                
                <div>
                    <label for="lastNameInput" class="block text-sm font-medium text-gray-700 mb-1">
                        Last Name <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="lastNameInput" 
                        name="lastName" 
                        required
                        value="${existingLastName}"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Enter your last name"
                    />
                </div>
                
                <div>
                    <label for="circleFieldInputComplete" class="block text-sm font-medium text-gray-700 mb-1">
                        ${fieldLabel} <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="circleFieldInputComplete" 
                        name="circleField" 
                        required
                        value="${existingValue}"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Enter your ID"
                    />
                </div>
                
                <button 
                    type="submit"
                    style="background-color: black" 
                    class="w-full text-white font-medium py-2 px-4 rounded-md transition duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                    Submit
                </button>
            </form>
            
            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p class="text-xs text-blue-800">
                    💡 <strong>Note:</strong> Only your ${fieldLabel} will be saved to your profile for future auto-fill. Your name is used only for this submission.
                </p>
            </div>
        </div>
    `;
    
    wrapper.innerHTML = formHtml;
    
    // Add form submit handler
    const form = document.getElementById('completeForm');
    if (form) {
        // Set up message listener for when form loads iframe
        setupMessageListener(setup, category);
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('firstNameInput').value.trim();
            const lastName = document.getElementById('lastNameInput').value.trim();
            const fieldValue = document.getElementById('circleFieldInputComplete').value.trim();
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!firstName || !lastName || !fieldValue) {
                debugWarn(category || 'Profile Field Sync', 'All fields are required');
                alert('Please fill in all required fields');
                return;
            }
            
            // Save and submit using helper function
            await saveFieldAndSubmit(setup, category, fieldValue, firstName, lastName, submitBtn);
        });
    }
}

/**
 * Wait for the profileFieldSyncWrapper div to be available (React needs time to render)
 * @returns {Promise<HTMLElement>} The wrapper element
 */
function waitForWrapper(setup, category) {
    return new Promise((resolve, reject) => {
        const wrapperId = (setup && setup.dom && setup.dom.wrapperId) ? setup.dom.wrapperId : 'profileFieldSyncWrapper';
        debugLog(category || 'Profile Field Sync', `Waiting for ${wrapperId} to be ready...`);
        debugLog(category || 'Profile Field Sync', `Waiting for wrapper... ${wrapperId}`);
        
        // First, check if it's already there
        const existingWrapper = document.getElementById(wrapperId);
        if (existingWrapper) {
            debugLog(category || 'Profile Field Sync', `${wrapperId} found immediately`);
            resolve(existingWrapper);
            return;
        }
        
        // If not, set up an observer to watch for it
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds (50 * 100ms)
        
        const checkInterval = setInterval(() => {
            attempts++;
            const wrapper = document.getElementById(wrapperId);
            
            if (wrapper) {
                clearInterval(checkInterval);
                debugLog(category || 'Profile Field Sync', `${wrapperId} found after ${attempts * 100}ms`);
                resolve(wrapper);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                debugError(category || 'Profile Field Sync', `${wrapperId} not found after timeout`);
                debugError(category || 'Profile Field Sync', 'wrapper not found after timeout');
                reject(new Error(`${wrapperId} div not found`));
            }
        }, 300); // Check every 100ms
    });
}

/**
 * Initialize profile field sync functionality.
 * Assumes routing is handled by page-scripts.js (and/or cfg.match).
 */
export async function initUpdateProfileFields() {
    // Initialize debug logger (only for this page)
    // initDebugLogger();

    const setups = normalizeSetups(rootCfg).filter(setupIsEnabled);
    if (setups.length === 0) return;

    for (const setup of setups) {
        if (!shouldRunSetup(setup)) continue;

        const category = setupCategory(setup);
        debugLog(category, 'Initializing...');

        try {
            // Wait for React to render the wrapper div for THIS setup
            await waitForWrapper(setup, category);

            // Check if user is logged in
            const publicUid = getCurrentUserPublicUid();
            if (!publicUid) {
                debugWarn(category, 'User not logged in - showing login prompt');
                showNotLoggedInMessage(setup, category);
                continue;
            }

            // Fetch the configured field value from profile
            const fieldValue = (await getFieldValue(setup, category)) || '';

            // Get user data
            const userData = getUserData();

            // Check what data we have
            const hasFirstName = !!userData.firstName;
            const hasLastName = !!userData.lastName;
            const hasFieldValue = !!fieldValue;
            const hasAllData = hasFieldValue && hasFirstName && hasLastName;
            const hasNames = hasFirstName && hasLastName;

            if (hasAllData) {
                // All data available - auto-submit
                debugSuccess(category, 'All data found - auto-submitting');
                await loadIframe(setup, category, fieldValue);

            } else if (hasNames && !hasFieldValue) {
                // Has first/last name, only missing field value - show simple form
                const fieldLabel = (setup && setup.profile && setup.profile.label) ? setup.profile.label : 'ID';
                debugWarn(category, `Missing: ${fieldLabel} only`);
                showFieldOnlyForm(setup, category, fieldValue);

            } else {
                // Missing first/last name (and maybe field) - show complete form
                const missingData = [];
                if (!hasFirstName) missingData.push('first name');
                if (!hasLastName) missingData.push('last name');
                if (!hasFieldValue) {
                    const fieldLabel = (setup && setup.profile && setup.profile.label) ? setup.profile.label : 'field';
                    missingData.push(fieldLabel);
                }

                debugWarn(category, `Missing: ${missingData.join(', ')}`);
                showCompleteDataForm(setup, category, fieldValue, userData.firstName, userData.lastName);
            }

            debugLog(category, 'Initialization complete');

        } catch (error) {
            debugError(category, `Initialization failed: ${String(error?.message || error)}`);
        }
    }
}

