/**
 * BlueConic Integration Module
 * 
 * Syncs user profile data from Circle.so to BlueConic CDP
 * Uses the shared profile-api module for enhanced data access
 */

import { getCurrentUserPublicUid, getUserData, getProfileData, getEnhancedUserData } from './profile-api.js';
import { debugError, debugLog, debugWarn } from './debug-logger.js';

/**
 * Initialize BlueConic sync
 * Called automatically on page load
 */
export async function initBlueConic() {
    debugLog('BlueConic Module: Initializing...');
    
    // Check if user is logged in
    if (!window.circleUser) {
        debugLog('BlueConic Module: No user data found in window.circleUser');
        return;
    }
    
    // Get basic user data
    const userData = getUserData();
    const domainKey = __CIRCLE_BLUECONIC_DOMAIN_KEY__;
    const demographicKey = "demographic_" + domainKey;
    
    // Build basic BlueConic user object
    const blueConicUser = {
        [`${domainKey}first_name`]: userData.firstName,
        [`${domainKey}surname`]: userData.lastName,
        "email": userData.email,
        [`${demographicKey}signed_in`]: String(userData.signedIn)
    };
    
    // Try to fetch extended profile data from API (custom fields)
    try {
        const profileResponse = await getProfileData();
        
        // Console log for debugging - see what's in the profile
        debugLog(`BlueConic Module: Profile Data: ${JSON.stringify(profileResponse)}`);
        
        if (profileResponse && profileResponse.customFields) {
            debugLog(`BlueConic Module: Custom Fields: ${JSON.stringify(profileResponse.customFields)}`);
            
            // Add custom fields from profile API
            // Example: BASIS ID
            // if (profileResponse.customFields.basis_id) {
            //     blueConicUser[`${demographicKey}basis_id`] = profileResponse.customFields.basis_id;
            // }
            
            // Add other custom fields as needed
            // You can add more mappings here based on your Circle.so custom fields
            // Examples:
            // if (profileResponse.customFields.company) {
            //     blueConicUser[`${demographicKey}company`] = profileResponse.customFields.company;
            // }
            // if (profileResponse.customFields.phone_number) {
            //     blueConicUser[`${demographicKey}phone_number`] = profileResponse.customFields.phone_number;
            // }
            
        } else {
            debugLog('BlueConic Module: No custom fields found');
        }
    } catch (error) {
        debugWarn(`BlueConic Module: Could not fetch profile data: ${String(error?.message || error)}`);
    }
    
    // Try to fetch enhanced user data (subscription, roles, policies)
    try {
        const enhancedData = await getEnhancedUserData();
        
        // Console log for debugging - see what's in the enhanced data
        debugLog(`BlueConic Module: Enhanced User Data: ${JSON.stringify(enhancedData)}`);
        
        if (enhancedData) {
            // Add subscription status
            if (enhancedData.hasActiveSubscription !== undefined) {
                blueConicUser[`${demographicKey}has_active_subscription`] = String(enhancedData.hasActiveSubscription);
            }
            
            // Add role information
            if (enhancedData.isAdmin !== undefined) {
                blueConicUser[`${demographicKey}is_admin`] = String(enhancedData.isAdmin);
            }
            
            if (enhancedData.isModerator !== undefined) {
                blueConicUser[`${demographicKey}is_moderator`] = String(enhancedData.isModerator);
            }
            
            // Add other useful fields as needed
            // Examples:
            // if (enhancedData.preferences?.visible_in_member_directory !== undefined) {
            //     blueConicUser[`${demographicKey}visible_in_directory`] = String(enhancedData.preferences.visible_in_member_directory);
            // }
            
            debugLog('BlueConic Module: Enhanced data added to sync');
        } else {
            debugLog('BlueConic Module: No enhanced data available');
        }
    } catch (error) {
        debugWarn(`BlueConic Module: Could not fetch enhanced user data: ${String(error?.message || error)}`);
    }
    
    // Console log final object being sent to BlueConic
    debugLog(`BlueConic Module: Final data to sync: ${JSON.stringify(blueConicUser)}`);
    
    // Update BlueConic profile
    await updateBlueconicProfileFields(blueConicUser);
}

/**
 * Update BlueConic profile with provided fields
 * Only updates fields that have changed (smart update)
 * 
 * @param {Object} blueConicUser - Object with BlueConic field mappings
 */
async function requireBlueConicClient(timeoutMs = 3000, intervalMs = 100) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (typeof blueConicClient !== 'undefined' && blueConicClient.profile) {
            return blueConicClient.profile;
        }
        await new Promise(function(resolve) {
            setTimeout(resolve, intervalMs);
        });
    }

    throw new Error('BlueConic client not available after waiting');
}

async function updateBlueconicProfileFields(blueConicUser) {
    try {
        // Check if BlueConic client is available
        var profileApi = await requireBlueConicClient();
        var profile = profileApi.getProfile();
        var properties = Object.keys(blueConicUser);
        
        if (!profile) {
            debugWarn('BlueConic Module: BlueConic profile not available');
            return;
        }
        
        // Load current values and compare
        profile.loadValues(properties, this, function() {
            var hasChanges = false;
            
            // Iterate through all key-value pairs in the blueConicUser object
            for (var key in blueConicUser) {
                if (blueConicUser.hasOwnProperty(key)) {
                    var currentValue = profile.getValue(key);
                    var newValue = blueConicUser[key];
                    
                    // Skip empty values
                    if (!newValue || newValue === '') {
                        continue;
                    }
                    
                    if (currentValue === newValue) {
                        debugLog('BlueConic Module: profile[' + key + '] is already set to "' + newValue + '"');
                    } else {
                        profile.setValue(key, newValue);
                        hasChanges = true;
                        debugLog('BlueConic Module: profile[' + key + '] updated from "' + currentValue + '" to "' + newValue + '"');
                    }
                }
            }
            
            // Only update the profile once if there were any changes
            if (hasChanges) {
                profileApi.updateProfile();
                debugLog('BlueConic Module: Profile updated with all changes');
            } else {
                debugLog('BlueConic Module: No changes detected, profile not updated');
            }
        });
        
    } catch (ex) {
        debugError(`BlueConic Module: Error updating profile: ${String(ex?.message || ex)}`);
    }
}

/**
 * Manually trigger BlueConic sync
 * Useful for debugging or triggering updates after profile changes
 */
export function syncBlueConic() {
    debugLog('BlueConic Module: Manual sync triggered');
    initBlueConic();
}

