/**
 * Profile API Module
 * 
 * Shared utilities for fetching and managing user profile data from Circle.so
 * This module can be imported by any other module that needs profile data.
 */

import { debugError, debugLog } from './debug-logger.js';

const STAYPOST_WEB_ORIGIN = __STAYPOST_WEB_ORIGIN__;

/**
 * Get current user's publicUid
 * @returns {string|null}
 */
export function getCurrentUserPublicUid() {
    return window.circleUser?.publicUid || null;
}

/**
 * Check if the current visitor is signed in.
 * @returns {boolean}
 */
function isSignedIn() {
    return Boolean(window.circleUser?.signedIn);
}

/**
 * Get basic user data from circleUser object
 * @returns {Object} User data with email, firstName, lastName, signedIn, etc.
 */
export function getUserData() {
    const user = window.circleUser || {};
    return {
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        signedIn: user.signedIn || false,
        isAdmin: user.isAdmin || false,
        isModerator: user.isModerator || false,
        publicUid: user.publicUid || '',
        profileUrl: user.profileUrl || '',
        location: user.location || '',
        websiteUrl: user.websiteUrl || '',
        linkedinUrl: user.linkedinUrl || '',
        twitterUrl: user.twitterUrl || '',
        facebookUrl: user.facebookUrl || ''
    };
}

/**
 * Fetch full profile data from the Circle.so Internal API
 * This includes custom profile fields that aren't in window.circleUser
 * 
 * @param {string} [publicUid] - Optional publicUid, defaults to current user
 * @returns {Promise<Object|null>} The full profile data or null if error
 */
export async function getProfileData(publicUid = null) {
    if (!publicUid && !isSignedIn()) return null;
    // Use provided publicUid or get current user's
    const uid = publicUid || getCurrentUserPublicUid();
    
    if (!uid) {
        // Not an error: logged-out visitors won't have a publicUid.
        // Callers should treat `null` as "no profile available".
        return null;
    }
    
    const url = `${STAYPOST_WEB_ORIGIN}/internal_api/profiles/${uid}?page_name=edit_profile`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const profileData = await response.json();
        
        debugLog('Profile API: Successfully fetched profile data');
        
        // Return structured data for easy access
        return {
            fullData: profileData,
            profileFields: profileData.profile_fields?.visible || [],
            customFields: extractCustomFields(profileData.profile_fields?.visible || [])
        };

    } catch (error) {
        debugError(`Profile API: Could not fetch profile data: ${String(error?.message || error)}`);
        return null;
    }
}

/**
 * Fetch enhanced user data from the pundit_users endpoint
 * This includes subscription status, roles, policies, and more
 * 
 * @returns {Promise<Object|null>} The enhanced user data or null if error
 */
export async function getEnhancedUserData() {
    const url = `${STAYPOST_WEB_ORIGIN}/internal_api/pundit_users?`;
    
    try {
        const response = await fetch(url, {
            credentials: 'same-origin' // Include session cookies
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        debugLog('Profile API: Successfully fetched enhanced user data');
        
        // Return structured data with commonly used fields
        return {
            fullData: data,
            currentUser: data.current_user,
            currentCommunityMember: data.current_community_member,
            
            // Subscription info
            hasActiveSubscription: data.current_community_member?.active_paywall_subscriptions || false,
            hasNonCancelableSubscription: data.current_community_member?.active_but_non_cancelable_paywall_subscriptions || false,
            
            // Roles & permissions
            isAdmin: data.current_community_member?.is_admin || false,
            isModerator: data.current_community_member?.is_moderator || false,
            roles: data.current_community_member?.roles || {},
            policies: data.current_community_member?.policies || {},
            
            // User preferences
            preferences: data.current_community_member?.preferences || {},
            
            // Community info
            currentCommunity: data.current_community
        };

    } catch (error) {
        debugError(`Profile API: Could not fetch enhanced user data: ${String(error?.message || error)}`);
        return null;
    }
}

/**
 * Extract custom profile fields into a key-value object
 * @param {Array} visibleFields - Array of visible profile fields from API
 * @returns {Object} Object with field keys as properties
 */
function extractCustomFields(visibleFields) {
    const fields = {};
    
    visibleFields.forEach(field => {
        const key = field.key;
        const memberField = field.community_member_profile_field;
        
        if (!key || !memberField) return;
        
        // Get value based on field type
        let value = '';
        if (memberField.text) {
            value = memberField.text;
        } else if (memberField.textarea) {
            value = memberField.textarea;
        } else if (memberField.payload) {
            value = memberField.payload;
        }
        
        fields[key] = value;
    });
    
    return fields;
}

/**
 * Get a specific custom field value by key
 * @param {string} fieldKey - The key of the field to retrieve (e.g., 'basis_id')
 * @param {string} [publicUid] - Optional publicUid, defaults to current user
 * @returns {Promise<string|null>} The field value or null
 */
export async function getCustomField(fieldKey, publicUid = null) {
    const profileResponse = await getProfileData(publicUid);
    
    if (!profileResponse || !profileResponse.customFields) {
        return null;
    }
    
    return profileResponse.customFields[fieldKey] || null;
}

/**
 * Update the user's profile with new data
 * @param {Object} updates - Object containing fields to update
 * @param {string} [publicUid] - Optional publicUid, defaults to current user
 * @returns {Promise<boolean>} True if successful
 */
export async function updateProfile(updates, publicUid = null) {
    if (!publicUid && !isSignedIn()) return false;
    const uid = publicUid || getCurrentUserPublicUid();
    
    if (!uid) {
        // Not an error: logged-out visitors can't update a profile.
        return false;
    }
    
    debugLog(`Profile API: Updating profile... ${JSON.stringify(updates)}`);
    
    // First, get the current profile data to preserve other fields
    const profileResponse = await getProfileData(uid);
    if (!profileResponse || !profileResponse.fullData) {
        debugError('Profile API: Cannot update - failed to fetch current profile');
        return false;
    }
    
    const profileData = profileResponse.fullData;
    
    // Build the update payload - must be wrapped in "community_member" key
    const payload = {
        community_member: {
            name: updates.name || profileData.name,
            avatar: updates.avatar || profileData.avatar,
            headline: updates.headline || profileData.headline,
            time_zone: updates.time_zone || profileData.time_zone,
            locale: updates.locale || profileData.locale,
            preferences: updates.preferences || profileData.preferences,
            community_member_profile_fields_attributes: []
        }
    };
    
    // Add all existing profile fields
    if (profileData.profile_fields?.visible) {
        profileData.profile_fields.visible.forEach(field => {
            const memberField = field.community_member_profile_field;
            const fieldData = {
                profile_field_id: field.id,
                id: memberField?.id
            };
            
            // Check if this field is being updated
            const fieldKey = field.key;
            if (updates.customFields && updates.customFields.hasOwnProperty(fieldKey)) {
                // Update with new value
                const typeMap = {
                    text: 'text',
                    textarea: 'textarea',
                    payload: 'payload'
                };
                const fieldType = typeMap[field.type];
                if (fieldType) {
                    fieldData[fieldType] = updates.customFields[fieldKey];
                }
            } else {
                // Keep existing value
                const typeMap = {
                    text: 'text',
                    textarea: 'textarea',
                    payload: 'payload'
                };
                const fieldType = typeMap[field.type];
                if (fieldType) {
                    fieldData[fieldType] = memberField?.[fieldType] || '';
                }
            }
            
            payload.community_member.community_member_profile_fields_attributes.push(fieldData);
        });
    }
    
    const url = `${STAYPOST_WEB_ORIGIN}/internal_api/profiles/${uid}`;
    
    debugLog('Profile API: Sending update request');
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            debugError(`Profile API: Update failed: ${String(response.status)} ${String(errorText)}`);
            return false;
        }
        
        const result = await response.json();
        debugLog('Profile API: Profile updated successfully');
        return true;
        
    } catch (error) {
        debugError(`Profile API: Update error: ${String(error?.message || error)}`);
        return false;
    }
}

/**
 * Update a single custom field value
 * @param {string} fieldKey - The key of the field to update
 * @param {string} value - The new value
 * @param {string} [publicUid] - Optional publicUid, defaults to current user
 * @returns {Promise<boolean>} True if successful
 */
export async function updateCustomField(fieldKey, value, publicUid = null) {
    return updateProfile({
        customFields: {
            [fieldKey]: value
        }
    }, publicUid);
}

