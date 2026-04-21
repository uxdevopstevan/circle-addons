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
import cfg from '@circle-config/profile-field-sync';

// Debug logger - comment out for production, uncomment for debugging
// import { initDebugLogger, debugLog, debugSuccess, debugError, debugWarn } from './debug-logger.js';

// No-op debug functions for production
const initDebugLogger = () => {};
const debugLog = () => {};
const debugSuccess = () => {};
const debugError = () => {};
const debugWarn = () => {};

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
function getWrapper() {
    const wrapperId = (cfg && cfg.dom && cfg.dom.wrapperId) ? cfg.dom.wrapperId : 'profileFieldSyncWrapper';
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) {
        debugError(`${wrapperId} div not found`);
        console.error('Profile Field Sync: wrapper div not found:', wrapperId);
    }
    return wrapper;
}

function shouldRun() {
    if (!cfg || cfg.enabled === false) return false;
    const match = cfg.match || {};
    const path = window.location.pathname || '';
    if (typeof match.pathIncludes === 'string' && match.pathIncludes.length > 0) {
        return path.includes(match.pathIncludes);
    }
    return true;
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

function createHiddenIframe(userData, fieldValue, customFields) {
    // Set up message listener for iframe communication
    setupMessageListener();
    
    // Build URL with parameters
    const baseUrl = cfg && cfg.submit && cfg.submit.baseUrl;
    if (!baseUrl) {
        console.error('Profile Field Sync: Missing submit.baseUrl in config');
        return;
    }
    const params = new URLSearchParams();

    const ctx = { userData: userData || {}, fieldValue, customFields: customFields || {} };

    // New config format: submit.fields[]
    if (cfg && cfg.submit && Array.isArray(cfg.submit.fields)) {
        for (const f of cfg.submit.fields) {
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
        const paramsCfg = (cfg && cfg.submit && cfg.submit.params) ? cfg.submit.params : {};
        params.append(paramsCfg.email || 'email', (userData && userData.email) || '');
        params.append(paramsCfg.firstName || 'firstName', (userData && userData.firstName) || '');
        params.append(paramsCfg.lastName || 'lastName', (userData && userData.lastName) || '');
        params.append(paramsCfg.fieldValue || 'value', fieldValue);
    }

    // Cache-busting timestamp (optional)
    if (!cfg || !cfg.submit || cfg.submit.includeTimestampParam !== false) {
        const name = (cfg && cfg.submit && cfg.submit.timestampParamName) ? cfg.submit.timestampParamName : '_t';
        params.append(name, String(Date.now()));
    }
    
    // Backward-compatible extras (only if NOT using submit.fields[])
    const usingFields = cfg && cfg.submit && Array.isArray(cfg.submit.fields);
    if (!usingFields) {
        // Add UTM parameters if present
        if (!cfg || !cfg.submit || cfg.submit.includeUtm !== false) {
            const utmParams = getUtmParams();
            if (utmParams.utm_source) params.append('utm_source', utmParams.utm_source);
            if (utmParams.utm_medium) params.append('utm_medium', utmParams.utm_medium);
            if (utmParams.utm_campaign) params.append('utm_campaign', utmParams.utm_campaign);
        }
        
        // Add course_name if present
        if (!cfg || !cfg.submit || cfg.submit.includeCourseName !== false) {
            const courseName = getCourseName();
            if (courseName) params.append('course_name', courseName);
        }
        
        // Add registration_claim if true
        if (!cfg || !cfg.submit || cfg.submit.includeRegistrationClaim !== false) {
            const registrationClaim = getRegistrationClaim();
            if (registrationClaim) params.append('registration_claim', 'true');
        }
    }
    
    const iframeUrl = `${baseUrl}?${params.toString()}`;
    
    debugSuccess(`Loading iframe - ${firstName} ${lastName}`);
    console.log('Profile Field Sync: Loading iframe with URL:', iframeUrl);
    
    // Show loading state
    showLoadingState();
    
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
    iframe.title = (cfg && cfg.profile && cfg.profile.label) ? `Submit ${cfg.profile.label}` : 'Submit';
    
    // Add to body (hidden from user)
    document.body.appendChild(iframe);
}

/**
 * Get configured field value from profile
 * Uses the shared profile API module
 * @returns {Promise<string|null>} The field value or null
 */
async function getFieldValue() {
    const profileResponse = await getProfileData();
    
    if (!profileResponse || !profileResponse.customFields) {
        debugError('Cannot get field value: Profile data not available');
        console.error('Profile Field Sync: Profile data not available');
        return null;
    }
    
    const fieldKey = cfg && cfg.profile && cfg.profile.fieldKey;
    const value = fieldKey ? (profileResponse.customFields[fieldKey] || null) : null;
    
    if (value) {
        const label = (cfg && cfg.profile && cfg.profile.label) ? cfg.profile.label : fieldKey || 'field';
        debugSuccess(`${label} found: ${value}`);
        console.log('Profile Field Sync: Field value:', value);
    }
    
    return value;
}

async function getProfileCustomFields() {
    const profileResponse = await getProfileData();
    if (!profileResponse || !profileResponse.customFields) return {};
    return profileResponse.customFields || {};
}

/**
 * Update the user's configured field in their profile
 * Uses the shared profile API module
 * @param {string} newValue - The new field value to save
 * @returns {Promise<boolean>} True if successful
 */
async function updateProfileField(newValue) {
    const fieldKey = cfg && cfg.profile && cfg.profile.fieldKey;
    if (!fieldKey) return false;
    debugLog(`Updating profile field ${fieldKey}: ${newValue}`);
    console.log('Profile Field Sync: Updating profile field:', fieldKey);
    
    // Use the shared updateCustomField function from profile-api
    const success = await updateCustomField(fieldKey, newValue);
    
    if (success) {
        debugSuccess('Profile updated successfully!');
        console.log('Profile Field Sync: Profile updated successfully');
    } else {
        debugError('Profile update failed');
        console.error('Profile Field Sync: Profile update failed');
    }
    
    return success;
}

/**
 * Show loading state
 */
function showLoadingState() {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    wrapper.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-8 text-center max-w-md mx-auto">
            <div class="mb-4">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">${(cfg && cfg.ui && cfg.ui.loadingTitle) ? cfg.ui.loadingTitle : 'Submitting'}</h3>
            <p class="text-gray-600">${(cfg && cfg.ui && cfg.ui.loadingBody) ? cfg.ui.loadingBody : 'Please wait while we process your submission...'}</p>
        </div>
    `;
    
    debugLog('Showing loading state');
}

/**
 * Show success state
 */
function showSuccessState() {
    const wrapper = getWrapper();
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
    
    debugSuccess('Showing success state');
}

/**
 * Message listener flag to ensure it's only set up once
 */
let messageListenerSetup = false;

/**
 * Listen for messages from the iframe
 */
function setupMessageListener() {
    if (messageListenerSetup) {
        debugLog('Message listener already setup, skipping');
        return;
    }

    const submittingType = (cfg && cfg.messages && cfg.messages.submittingType) ? cfg.messages.submittingType : 'FORM_SUBMITTING';
    const successType = (cfg && cfg.messages && cfg.messages.successType) ? cfg.messages.successType : 'FORM_SUCCESS';
    const successFlagKey = (cfg && cfg.messages && cfg.messages.successFlagKey) ? cfg.messages.successFlagKey : 'success';
    
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
            debugLog(`Received message: ${event.data.type}`);
            console.log('Profile Field Sync: Received message:', event.data);
            
            if (event.data.type === submittingType) {
                // Form is being submitted, show loading state
                showLoadingState();
            } else if (event.data.type === successType && (!successFlagKey || event.data[successFlagKey])) {
                // Form submitted successfully
                showSuccessState();
            }
        }
    });
    
    messageListenerSetup = true;
    debugLog('Message listener setup complete');
    console.log('Profile Field Sync: Listening for iframe messages');
}

/**
 * Save configured field to profile and load iframe
 * @param {string} fieldValue - field value to save
 * @param {string} firstName - First name for submission
 * @param {string} lastName - Last name for submission
 * @param {HTMLElement} submitBtn - Optional submit button to show loading state
 */
async function saveFieldAndSubmit(fieldValue, firstName, lastName, submitBtn = null) {
    debugSuccess(`Submitting - First: ${firstName}, Last: ${lastName}`);
    console.log('Profile Field Sync: Processing submission');
    
    // Show button loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }
    
    const fieldLabel = (cfg && cfg.profile && cfg.profile.label) ? cfg.profile.label : 'field';
    debugLog(`Saving ${fieldLabel} to profile (name not saved)...`);
    const updateSuccess = await updateProfileField(fieldValue);
    
    if (updateSuccess) {
        debugSuccess(`${fieldLabel} saved to profile!`);
    } else {
        debugWarn('Could not save to profile, but continuing with submission');
    }
    
    // Load iframe with data
    const userData = getUserData();
    const customFields = await getProfileCustomFields();
    createHiddenIframe(userData, fieldValue, customFields);
}

/**
 * Load iframe using data from user profile
 * @param {string} fieldValue - The field value
 */
async function loadIframe(fieldValue) {
    const userData = getUserData();
    const customFields = await getProfileCustomFields();
    createHiddenIframe(userData, fieldValue, customFields);
}

/**
 * Show not logged in message
 */
function showNotLoggedInMessage() {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    debugWarn('User not logged in');
    console.log('Profile Field Sync: Showing not logged in message');
    
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
function showFieldOnlyForm(existingValue = '') {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    const fieldLabel = (cfg && cfg.profile && cfg.profile.label) ? cfg.profile.label : 'ID';
    debugWarn(`Showing ${fieldLabel} form (user has name)`);
    console.log('Profile Field Sync: Showing field-only form');
    
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
        setupMessageListener();
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fieldValue = document.getElementById('circleFieldInput').value.trim();
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!fieldValue) {
                debugWarn(`${fieldLabel} is required`);
                alert(`Please enter your ${fieldLabel}`);
                return;
            }
            
            // Get names from profile
            const userData = getUserData();
            
            // Save and submit
            await saveFieldAndSubmit(fieldValue, userData.firstName, userData.lastName, submitBtn);
        });
    }
}

/**
 * Show complete form when user data is missing (first/last name or field value)
 * @param {string} existingValue - Existing field value if found
 * @param {string} existingFirstName - Existing first name if found
 * @param {string} existingLastName - Existing last name if found
 */
function showCompleteDataForm(existingValue = '', existingFirstName = '', existingLastName = '') {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    const fieldLabel = (cfg && cfg.profile && cfg.profile.label) ? cfg.profile.label : 'ID';
    debugWarn(`Showing complete data form (missing first/last name and/or ${fieldLabel})`);
    console.log('Profile Field Sync: Showing complete data form');
    
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
        setupMessageListener();
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('firstNameInput').value.trim();
            const lastName = document.getElementById('lastNameInput').value.trim();
            const fieldValue = document.getElementById('circleFieldInputComplete').value.trim();
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!firstName || !lastName || !fieldValue) {
                debugWarn('All fields are required');
                alert('Please fill in all required fields');
                return;
            }
            
            // Save and submit using helper function
            await saveFieldAndSubmit(fieldValue, firstName, lastName, submitBtn);
        });
    }
}

/**
 * Wait for the profileFieldSyncWrapper div to be available (React needs time to render)
 * @returns {Promise<HTMLElement>} The wrapper element
 */
function waitForWrapper() {
    return new Promise((resolve, reject) => {
        const wrapperId = (cfg && cfg.dom && cfg.dom.wrapperId) ? cfg.dom.wrapperId : 'profileFieldSyncWrapper';
        debugLog(`Waiting for ${wrapperId} to be ready...`);
        console.log('Profile Field Sync: Waiting for wrapper...', wrapperId);
        
        // First, check if it's already there
        const existingWrapper = document.getElementById(wrapperId);
        if (existingWrapper) {
            debugSuccess(`${wrapperId} found immediately`);
            console.log('Profile Field Sync: wrapper found immediately');
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
                debugSuccess(`${wrapperId} found after ${attempts * 100}ms`);
                console.log(`Profile Field Sync: wrapper found after ${attempts * 100}ms`);
                resolve(wrapper);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                debugError(`${wrapperId} not found after timeout`);
                console.error('Profile Field Sync: wrapper not found after timeout');
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
    
    if (!shouldRun()) return;

    debugLog('Profile Field Sync: Initializing...');
    console.log('Profile Field Sync: Initializing...');
    
    try {
        // Wait for React to render the wrapper div
        await waitForWrapper();
        
        // Check if user is logged in
        const publicUid = getCurrentUserPublicUid();
        if (!publicUid) {
            debugWarn('User not logged in - showing login prompt');
            console.log('Profile Field Sync: User not logged in');
            showNotLoggedInMessage();
            return;
        }
        
        // Fetch the configured field value from profile
        const fieldValue = await getFieldValue() || '';
        
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
            debugSuccess(`All data found - auto-submitting`);
            console.log('Profile Field Sync: All required data found, auto-submitting');
            await loadIframe(fieldValue);
            
        } else if (hasNames && !hasFieldValue) {
            // Has first/last name, only missing field value - show simple form
            const fieldLabel = (cfg && cfg.profile && cfg.profile.label) ? cfg.profile.label : 'ID';
            debugWarn(`Missing: ${fieldLabel} only`);
            console.log('Profile Field Sync: Missing field only, showing simple form');
            showFieldOnlyForm(fieldValue);
            
        } else {
            // Missing first/last name (and maybe field) - show complete form
            const missingData = [];
            if (!hasFirstName) missingData.push('first name');
            if (!hasLastName) missingData.push('last name');
            if (!hasFieldValue) {
                const fieldLabel = (cfg && cfg.profile && cfg.profile.label) ? cfg.profile.label : 'field';
                missingData.push(fieldLabel);
            }
            
            debugWarn(`Missing: ${missingData.join(', ')}`);
            console.log('Profile Field Sync: Missing data, showing complete form');
            showCompleteDataForm(fieldValue, userData.firstName, userData.lastName);
        }
        
        debugLog('Initialization complete');
        console.log('Profile Field Sync: Initialization complete');
        
    } catch (error) {
        debugError(`Initialization failed: ${error.message}`);
        console.error('Profile Field Sync: Initialization failed:', error);
    }
}

