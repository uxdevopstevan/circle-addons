/**
 * Basis Points Submission Module
 * 
 * Fetches user profile data including basis_id and handles
 * basis points submission functionality.
 * 
 * Note: This module is called by page-scripts.js when on the submit-basis-points page.
 */

// Import shared profile API utilities
import { getCurrentUserPublicUid, getUserData, getProfileData, updateCustomField } from './profile-api.js';

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
 * Get the basisFormWrapper element
 * @returns {HTMLElement|null}
 */
function getWrapper() {
    const wrapper = document.getElementById('basisFormWrapper');
    if (!wrapper) {
        debugError('basisFormWrapper div not found');
        console.error('Basis Points Module: basisFormWrapper div not found');
    }
    return wrapper;
}

/**
 * Create and load hidden iframe with form submission
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} lastName - User last name
 * @param {string} basisId - BASIS member ID
 */
function createHiddenIframe(email, firstName, lastName, basisId) {
    // Set up message listener for iframe communication
    setupMessageListener();
    
    // Build URL with parameters
    const baseUrl = __CIRCLE_BASIS_POINTS_BASE_URL__;
    const params = new URLSearchParams({
        email,
        firstName,
        lastName,
        basisId,
        _t: Date.now() // Cache-busting timestamp
    });
    
    // Add UTM parameters if present
    const utmParams = getUtmParams();
    if (utmParams.utm_source) params.append('utm_source', utmParams.utm_source);
    if (utmParams.utm_medium) params.append('utm_medium', utmParams.utm_medium);
    if (utmParams.utm_campaign) params.append('utm_campaign', utmParams.utm_campaign);
    
    // Add course_name if present
    const courseName = getCourseName();
    if (courseName) params.append('course_name', courseName);
    
    // Add registration_claim if true
    const registrationClaim = getRegistrationClaim();
    if (registrationClaim) params.append('registration_claim', 'true');
    
    const iframeUrl = `${baseUrl}?${params.toString()}`;
    
    debugSuccess(`Loading iframe - ${firstName} ${lastName}, BASIS: ${basisId}`);
    if (utmParams.utm_source || utmParams.utm_medium || utmParams.utm_campaign) {
        debugLog(`UTM params: ${JSON.stringify(utmParams)}`);
    }
    if (courseName) {
        debugLog(`Course name: ${courseName}`);
    }
    if (registrationClaim) {
        debugLog(`Registration claim: true`);
    }
    console.log('Basis Points Module: Loading iframe with URL:', iframeUrl);
    
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
    iframe.title = 'Submit BASIS Points';
    
    // Add to body (hidden from user)
    document.body.appendChild(iframe);
}

/**
 * Get BASIS ID from profile
 * Uses the shared profile API module
 * @returns {Promise<string|null>} The BASIS ID or null
 */
async function getBasisId() {
    const profileResponse = await getProfileData();
    
    if (!profileResponse || !profileResponse.customFields) {
        debugError('Cannot get BASIS ID: Profile data not available');
        console.error('Basis Points Module: Profile data not available');
        return null;
    }
    
    const basisId = profileResponse.customFields.basis_id || null;
    
    if (basisId) {
        debugSuccess(`BASIS ID found: ${basisId}`);
        console.log('Basis Points Module: BASIS ID:', basisId);
    }
    
    return basisId;
}

/**
 * Update the user's BASIS ID in their profile
 * Uses the shared profile API module
 * @param {string} newBasisId - The new BASIS ID to save
 * @returns {Promise<boolean>} True if successful
 */
async function updateProfileBasisId(newBasisId) {
    debugLog(`Updating profile with BASIS ID: ${newBasisId}`);
    console.log('Basis Points Module: Updating profile with BASIS ID:', newBasisId);
    
    // Use the shared updateCustomField function from profile-api
    const success = await updateCustomField('basis_id', newBasisId);
    
    if (success) {
        debugSuccess('Profile updated successfully!');
        console.log('Basis Points Module: Profile updated successfully');
    } else {
        debugError('Profile update failed');
        console.error('Basis Points Module: Profile update failed');
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
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Submitting BASIS Points</h3>
            <p class="text-gray-600">Please wait while we process your submission...</p>
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
            <p class="text-lg text-gray-800 mb-2">Thank you for submitting your BASIS points.</p>
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
    
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
            debugLog(`Received message: ${event.data.type}`);
            console.log('Basis Points Module: Received message:', event.data);
            
            if (event.data.type === 'BASIS_FORM_SUBMITTING') {
                // Form is being submitted, show loading state
                showLoadingState();
            } else if (event.data.type === 'BASIS_FORM_SUCCESS' && event.data.success) {
                // Form submitted successfully
                showSuccessState();
            }
        }
    });
    
    messageListenerSetup = true;
    debugLog('Message listener setup complete');
    console.log('Basis Points Module: Listening for iframe messages');
}

/**
 * Save BASIS ID to profile and load iframe
 * @param {string} basisId - BASIS member ID to save
 * @param {string} firstName - First name for submission
 * @param {string} lastName - Last name for submission
 * @param {HTMLElement} submitBtn - Optional submit button to show loading state
 */
async function saveBasisIdAndSubmit(basisId, firstName, lastName, submitBtn = null) {
    debugSuccess(`Submitting - First: ${firstName}, Last: ${lastName}, BASIS: ${basisId}`);
    console.log('Basis Points Module: Processing submission');
    
    // Show button loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }
    
    // Save ONLY BASIS ID to profile (not name)
    debugLog('Saving BASIS ID to profile (name not saved)...');
    const updateSuccess = await updateProfileBasisId(basisId);
    
    if (updateSuccess) {
        debugSuccess('BASIS ID saved to profile!');
    } else {
        debugWarn('Could not save to profile, but continuing with submission');
    }
    
    // Load iframe with data
    const userData = getUserData();
    createHiddenIframe(userData.email, firstName, lastName, basisId);
}

/**
 * Load iframe with BASIS form using data from user profile
 * @param {string} basisId - The BASIS member ID
 */
function loadBasisIframe(basisId) {
    const userData = getUserData();
    createHiddenIframe(userData.email, userData.firstName, userData.lastName, basisId);
}

/**
 * Show not logged in message
 */
function showNotLoggedInMessage() {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    debugWarn('User not logged in');
    console.log('Basis Points Module: Showing not logged in message');
    
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
            <p class="text-lg text-gray-700 mb-4">You need to be logged in to claim your BASIS CPD points.</p>
            <p class="text-sm text-gray-600 mb-6">Sign in to your Staypost account to continue.</p>
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
 * Show simple BASIS ID form (when user has first/last name)
 * @param {string} existingBasisId - Existing BASIS ID if found
 */
function showBasisIdOnlyForm(existingBasisId = '') {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    debugWarn('Showing BASIS ID form (user has name)');
    console.log('Basis Points Module: Showing BASIS ID only form');
    
    const formHtml = `
        <div class="bg-white rounded-lg p-6 max-w-md mx-auto">
            <div class="mb-6">
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Enter Your BASIS Member ID</h3>
                <p class="text-sm text-gray-600">Please enter your BASIS member ID below to claim your CPD points.</p>
            </div>
            
            <form id="basisSimpleForm" class="space-y-4">
                <div>
                    <label for="basisIdInput" class="block text-sm font-medium text-gray-700 mb-1">
                        BASIS Member ID <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="basisIdInput" 
                        name="basisId" 
                        required
                        value="${existingBasisId}"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Enter your BASIS ID"
                    />
                </div>
                
                <button 
                    type="submit"
                    style="background-color: black" 
                    class="w-full text-white font-medium py-2 px-4 rounded-md transition duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                    Submit to Claim Points
                </button>
            </form>
            
            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p class="text-xs text-blue-800">
                    💡 <strong>Tip:</strong> Your BASIS member ID will be saved to your profile for future auto-fill.
                </p>
            </div>
        </div>
    `;
    
    wrapper.innerHTML = formHtml;
    
    // Add form submit handler
    const form = document.getElementById('basisSimpleForm');
    if (form) {
        setupMessageListener();
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const basisId = document.getElementById('basisIdInput').value.trim();
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!basisId) {
                debugWarn('BASIS ID is required');
                alert('Please enter your BASIS member ID');
                return;
            }
            
            // Get names from profile
            const userData = getUserData();
            
            // Save and submit
            await saveBasisIdAndSubmit(basisId, userData.firstName, userData.lastName, submitBtn);
        });
    }
}

/**
 * Show complete form when user data is missing (first/last name or BASIS ID)
 * @param {string} existingBasisId - Existing BASIS ID if found
 * @param {string} existingFirstName - Existing first name if found
 * @param {string} existingLastName - Existing last name if found
 */
function showCompleteDataForm(existingBasisId = '', existingFirstName = '', existingLastName = '') {
    const wrapper = getWrapper();
    if (!wrapper) return;
    
    debugWarn('Showing complete data form (missing first/last name AND/OR BASIS ID)');
    console.log('Basis Points Module: Showing complete data form');
    
    // Create form HTML with Tailwind classes
    const formHtml = `
        <div class="bg-white rounded-lg p-6 max-w-md mx-auto">
            <div class="mb-6">
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Complete Your Details</h3>
                <p class="text-sm text-gray-600">Please provide the following information to claim your BASIS CPD points.</p>
            </div>
            
            <form id="basisCompleteForm" class="space-y-4">
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
                    <label for="basisIdInput" class="block text-sm font-medium text-gray-700 mb-1">
                        BASIS Member ID <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="basisIdInput" 
                        name="basisId" 
                        required
                        value="${existingBasisId}"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        placeholder="Enter your BASIS ID"
                    />
                </div>
                
                <button 
                    type="submit"
                    style="background-color: black" 
                    class="w-full text-white font-medium py-2 px-4 rounded-md transition duration-200 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                    Submit to Claim Points
                </button>
            </form>
            
            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p class="text-xs text-blue-800">
                    💡 <strong>Note:</strong> Only your BASIS member ID will be saved to your profile for future auto-fill. Your name is used only for this submission.
                </p>
            </div>
        </div>
    `;
    
    wrapper.innerHTML = formHtml;
    
    // Add form submit handler
    const form = document.getElementById('basisCompleteForm');
    if (form) {
        // Set up message listener for when form loads iframe
        setupMessageListener();
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('firstNameInput').value.trim();
            const lastName = document.getElementById('lastNameInput').value.trim();
            const basisId = document.getElementById('basisIdInput').value.trim();
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!firstName || !lastName || !basisId) {
                debugWarn('All fields are required');
                alert('Please fill in all required fields');
                return;
            }
            
            // Save and submit using helper function
            await saveBasisIdAndSubmit(basisId, firstName, lastName, submitBtn);
        });
    }
}

/**
 * Wait for the basisFormWrapper div to be available (React needs time to render)
 * @returns {Promise<HTMLElement>} The wrapper element
 */
function waitForWrapper() {
    return new Promise((resolve, reject) => {
        debugLog('Waiting for basisFormWrapper to be ready...');
        console.log('Basis Points Module: Waiting for basisFormWrapper...');
        
        // First, check if it's already there
        const existingWrapper = document.getElementById('basisFormWrapper');
        if (existingWrapper) {
            debugSuccess('basisFormWrapper found immediately');
            console.log('Basis Points Module: basisFormWrapper found immediately');
            resolve(existingWrapper);
            return;
        }
        
        // If not, set up an observer to watch for it
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds (50 * 100ms)
        
        const checkInterval = setInterval(() => {
            attempts++;
            const wrapper = document.getElementById('basisFormWrapper');
            
            if (wrapper) {
                clearInterval(checkInterval);
                debugSuccess(`basisFormWrapper found after ${attempts * 100}ms`);
                console.log(`Basis Points Module: basisFormWrapper found after ${attempts * 100}ms`);
                resolve(wrapper);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                debugError('basisFormWrapper not found after 5 seconds');
                console.error('Basis Points Module: basisFormWrapper not found after timeout');
                reject(new Error('basisFormWrapper div not found'));
            }
        }, 300); // Check every 100ms
    });
}

/**
 * Initialize basis points submission functionality
 * Assumes we're already on the submit-basis-points page (routing handled by page-scripts.js)
 */
export async function initBasisPoints() {
    // Initialize debug logger (only for BASIS points page)
    // initDebugLogger();
    
    debugLog('Basis Points Module: Initializing...');
    console.log('Basis Points Module: Initializing...');
    
    try {
        // Wait for React to render the wrapper div
        await waitForWrapper();
        
        // Check if user is logged in
        const publicUid = getCurrentUserPublicUid();
        if (!publicUid) {
            debugWarn('User not logged in - showing login prompt');
            console.log('Basis Points Module: User not logged in');
            showNotLoggedInMessage();
            return;
        }
        
        // Fetch the BASIS ID from profile
        const basisId = await getBasisId() || '';
        
        // Get user data
        const userData = getUserData();
        
        // Check what data we have
        const hasFirstName = !!userData.firstName;
        const hasLastName = !!userData.lastName;
        const hasBasisId = !!basisId;
        const hasAllData = hasBasisId && hasFirstName && hasLastName;
        const hasNames = hasFirstName && hasLastName;
        
        if (hasAllData) {
            // All data available - auto-submit
            debugSuccess(`All data found - auto-submitting`);
            console.log('Basis Points Module: All required data found, auto-submitting');
            loadBasisIframe(basisId);
            
        } else if (hasNames && !hasBasisId) {
            // Has first/last name, only missing BASIS ID - show simple form
            debugWarn('Missing: BASIS ID only');
            console.log('Basis Points Module: Missing BASIS ID only, showing simple form');
            showBasisIdOnlyForm(basisId);
            
        } else {
            // Missing first/last name (and maybe BASIS ID) - show complete form
            const missingData = [];
            if (!hasFirstName) missingData.push('first name');
            if (!hasLastName) missingData.push('last name');
            if (!hasBasisId) missingData.push('BASIS ID');
            
            debugWarn(`Missing: ${missingData.join(', ')}`);
            console.log('Basis Points Module: Missing name data, showing complete form');
            showCompleteDataForm(basisId, userData.firstName, userData.lastName);
        }
        
        debugLog('Initialization complete');
        console.log('Basis Points Module: Initialization complete');
        
    } catch (error) {
        debugError(`Initialization failed: ${error.message}`);
        console.error('Basis Points Module: Initialization failed:', error);
    }
}

