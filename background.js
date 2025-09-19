// Google Forms AutoFill - Background Script
// Centralized logic for handling popup and content script communication

// Check if Chrome Extension APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Chrome Extension APIs not available in background script');
} else {

class AutoFillBackground {
    constructor() {
        this.profiles = [];
        this.activeProfileId = null;
        this.isInitialized = false;
        this.contextMenusCreated = false;
        this.contextMenuUpdateTimeout = null;
        this.contextMenusEnabled = true; // Can be disabled if causing issues
        this.initPromise = this.init();
    }

    async init() {
        try {
            console.log('AutoFill Background Script initializing...');
            
            // Setup event listeners first (so popup can connect)
            this.setupMessageListeners();
            this.setupStorageListeners();
            this.setupKeyboardShortcuts();
            
            // Load profiles from storage
            await this.loadProfiles();
            
            // Setup context menus
            this.setupContextMenus();
            
            // Add profiles to context menus after loading
            if (this.contextMenusCreated) {
                this.updateContextMenuProfiles();
            }
            
            this.isInitialized = true;
            console.log('AutoFill Background Script initialized successfully');
        } catch (error) {
            console.error('Failed to initialize background script:', error);
        }
    }

    setupMessageListeners() {
        // Listen for messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Will respond asynchronously
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            // Wait for initialization if not ready
            if (!this.isInitialized) {
                await this.initPromise;
            }
            
            switch (message.action) {
                // Profile management
                case 'getProfiles':
                    sendResponse({ success: true, profiles: this.profiles });
                    break;

                case 'saveProfile':
                    await this.saveProfile(message.profile);
                    sendResponse({ success: true });
                    break;

                case 'deleteProfile':
                    await this.deleteProfile(message.profileId);
                    sendResponse({ success: true });
                    break;

                case 'duplicateProfile':
                    const duplicated = await this.duplicateProfile(message.profileId);
                    sendResponse({ success: true, profile: duplicated });
                    break;

                // Form filling
                case 'fillForm':
                    const result = await this.fillFormWithProfile(message.profileId, sender.tab.id);
                    sendResponse(result);
                    break;

                case 'detectFields':
                    const fields = await this.detectFormFields(sender.tab.id);
                    sendResponse({ success: true, fields: fields });
                    break;

                // Settings and shortcuts
                case 'updateShortcuts':
                    await this.updateKeyboardShortcuts();
                    sendResponse({ success: true });
                    break;

                case 'exportProfiles':
                    sendResponse({ success: true, data: this.profiles });
                    break;

                case 'importProfiles':
                    await this.importProfiles(message.profiles);
                    sendResponse({ success: true });
                    break;

                case 'deleteAllProfiles':
                    const deletedCount = await this.deleteAllProfiles();
                    sendResponse({ success: true, deletedCount: deletedCount });
                    break;

                // Storage operations
                case 'clearAllData':
                    await this.clearAllData();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // Profile Management Methods
    async loadProfiles() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['autofillProfiles'], (result) => {
                this.profiles = result.autofillProfiles || [];
                console.log(`Loaded ${this.profiles.length} profiles`);
                resolve(this.profiles);
            });
        });
    }

    async saveProfiles() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ autofillProfiles: this.profiles }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving profiles:', chrome.runtime.lastError.message);
                } else {
                    console.log('Profiles saved to storage');
                }
                this.broadcastProfilesUpdate();
                resolve();
            });
        });
    }

    async saveProfile(profile) {
        const existingIndex = this.profiles.findIndex(p => p.id === profile.id);
        
        if (existingIndex >= 0) {
            // Update existing profile
            this.profiles[existingIndex] = { ...profile, updatedAt: Date.now() };
        } else {
            // Add new profile
            profile.id = profile.id || this.generateProfileId();
            profile.createdAt = Date.now();
            profile.updatedAt = Date.now();
            this.profiles.push(profile);
        }
        
        await this.saveProfiles();
        return profile;
    }

    async deleteProfile(profileId) {
        const index = this.profiles.findIndex(p => p.id === profileId);
        if (index >= 0) {
            this.profiles.splice(index, 1);
            await this.saveProfiles();
        }
    }

    async duplicateProfile(profileId) {
        const original = this.profiles.find(p => p.id === profileId);
        if (!original) {
            throw new Error('Profile not found');
        }

        const duplicate = {
            ...original,
            id: this.generateProfileId(),
            name: original.name + ' (копия)',
            shortcut: '', // Remove shortcut from duplicate
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.profiles.push(duplicate);
        await this.saveProfiles();
        return duplicate;
    }

    async deleteAllProfiles() {
        console.log('🗑️ Deleting all profiles...');
        const deletedCount = this.profiles.length;
        
        if (deletedCount === 0) {
            console.log('   ℹ️ No profiles to delete');
            return 0;
        }
        
        console.log(`   🔄 Deleting ${deletedCount} profiles`);
        
        // Clear the profiles array
        this.profiles = [];
        
        // Save the empty profiles array to storage
        await this.saveProfiles();
        
        console.log(`   ✅ Successfully deleted all ${deletedCount} profiles`);
        return deletedCount;
    }

    generateProfileId() {
        return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Form Filling Methods
    async fillFormWithProfile(profileId, tabId, chainContext = { visited: new Set(), depth: 0 }) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            return { success: false, error: 'Profile not found' };
        }

        // Prevent infinite loops
        if (chainContext.visited.has(profileId)) {
            console.warn(`Circular chain detected for profile: ${profile.name}`);
            this.showNotification('Wykryto cykliczny łańcuch profili - zatrzymano', 'warning');
            return { success: false, error: 'Circular chain detected' };
        }

        // Prevent excessive chain length
        if (chainContext.depth >= 10) {
            console.warn(`Chain too long (${chainContext.depth}) - stopping execution`);
            this.showNotification('Łańcuch profili za długi - zatrzymano', 'warning');
            return { success: false, error: 'Chain too long' };
        }

        // Add current profile to visited set
        chainContext.visited.add(profileId);

        try {
            console.log(`🔗 Executing profile in chain: ${profile.name} (depth: ${chainContext.depth})`);
            
            // Send profile to content script for filling
            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'fillFormAdvanced',
                    profile: profile
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response || { success: false, error: 'No response from content script' });
                    }
                });
            });

            // Log usage statistics only on success
            if (response.success) {
                await this.logProfileUsage(profileId);
                
                // If this profile has a next profile and current filling was successful, execute the chain
                if (profile.nextProfileId) {
                    console.log(`🔗 Profile ${profile.name} completed, continuing chain to next profile`);
                    this.showNotification(`Профіль ${profile.name} ukończony, przechodząc do następnego...`);
                    
                    // Execute next profile in chain after a short delay
                    setTimeout(async () => {
                        const nextChainContext = {
                            visited: new Set(chainContext.visited),
                            depth: chainContext.depth + 1
                        };
                        
                        await this.fillFormWithProfile(profile.nextProfileId, tabId, nextChainContext);
                    }, 1000); // 1 second delay between profile executions
                }
            }

            return response;
        } catch (error) {
            console.error('Error filling form:', error);
            return { success: false, error: error.message };
        }
    }

    async detectFormFields(tabId) {
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'detectFields'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response || { success: false, fields: [] });
                    }
                });
            });
            
            return response.fields || [];
        } catch (error) {
            console.error('Error detecting fields:', error);
            return [];
        }
    }

    async logProfileUsage(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) {
            profile.lastUsed = Date.now();
            profile.usageCount = (profile.usageCount || 0) + 1;
            await this.saveProfiles();
        }
    }

    // Keyboard Shortcuts
    setupKeyboardShortcuts() {
        // Listen for keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleKeyboardCommand(command);
        });

        // Listen for custom shortcuts from content scripts
        chrome.runtime.onMessage.addListener((message, sender) => {
            if (message.action === 'keyboardShortcut') {
                this.handleCustomShortcut(message.shortcut, sender.tab.id);
            }
        });
    }

    async handleKeyboardCommand(command) {
        const activeTab = await this.getActiveTab();
        if (!activeTab) return;

        console.log(`Keyboard command received: ${command}`);

        switch (command) {
            case 'detect-fields':
                await this.detectAndShowFields(activeTab.id);
                break;
                
            case 'show-help':
                await this.showHelpOverlay(activeTab.id);
                break;
                
            case 'open-popup':
                // This will be handled by the browser automatically
                break;
                
            default:
                console.warn(`Unknown keyboard command: ${command}`);
        }
    }

    async handleCustomShortcut(shortcut, tabId) {
        // Handle reserved shortcuts for special functions (Ctrl+Shift+...)
        switch (shortcut) {
            case 'Ctrl+Shift+F':
                await this.fillWithLastUsedProfile(tabId);
                return;
            case 'Ctrl+Shift+M':
                await this.fillWithMostUsedProfile(tabId);
                return;
            case 'Ctrl+Shift+1':
                await this.fillWithQuickProfile(0, tabId);
                return;
            case 'Ctrl+Shift+2':
                await this.fillWithQuickProfile(1, tabId);
                return;
            case 'Ctrl+Shift+3':
                await this.fillWithQuickProfile(2, tabId);
                return;
        }
        
        // Handle profile-specific shortcuts (Alt+..., Ctrl+Alt+... for compatibility)
        const profile = this.profiles.find(p => p.shortcut === shortcut);
        if (profile) {
            console.log(`Found profile for shortcut ${shortcut}:`, profile.name);
            await this.fillFormWithProfile(profile.id, tabId);
        } else {
            console.log(`No profile found for shortcut: ${shortcut}`);
        }
    }

    async fillWithLastUsedProfile(tabId) {
        const lastUsedProfile = this.profiles
            .filter(p => p.lastUsed)
            .sort((a, b) => b.lastUsed - a.lastUsed)[0];

        if (lastUsedProfile) {
            console.log(`Filling with last used profile: ${lastUsedProfile.name}`);
            await this.fillFormWithProfile(lastUsedProfile.id, tabId);
            this.showNotification(`Wypełniono ostatnio używanym profilem: ${lastUsedProfile.name}`);
        } else {
            this.showNotification('Brak ostatnio używanego profilu', 'warning');
        }
    }

    async fillWithMostUsedProfile(tabId) {
        const mostUsedProfile = this.profiles
            .filter(p => p.usageCount)
            .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0];

        if (mostUsedProfile) {
            console.log(`Filling with most used profile: ${mostUsedProfile.name}`);
            await this.fillFormWithProfile(mostUsedProfile.id, tabId);
            this.showNotification(`Wypełniono najczęściej używanym profilem: ${mostUsedProfile.name}`);
        } else {
            this.showNotification('Brak najczęściej używanego profilu', 'warning');
        }
    }

    async fillWithQuickProfile(index, tabId) {
        // Get profiles sorted by usage or creation date
        const sortedProfiles = this.profiles
            .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || b.createdAt - a.createdAt);

        if (sortedProfiles[index]) {
            const profile = sortedProfiles[index];
            console.log(`Filling with quick profile ${index + 1}: ${profile.name}`);
            await this.fillFormWithProfile(profile.id, tabId);
            this.showNotification(`Wypełniono profilem ${index + 1}: ${profile.name}`);
        } else {
            this.showNotification(`Brak profilu na pozycji ${index + 1}`, 'warning');
        }
    }

    async detectAndShowFields(tabId) {
        try {
            const fields = await this.detectFormFields(tabId);
            console.log(`Detected ${fields.length} fields on current page`);
            
            // Send notification to content script to show detected fields
            await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'showDetectedFields',
                    fields: fields
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            this.showNotification(`Wykryto ${fields.length} pól formularza`);
        } catch (error) {
            console.error('Error detecting fields:', error);
            this.showNotification('Błąd podczas wykrywania pól', 'error');
        }
    }

    async showHelpOverlay(tabId) {
        try {
            await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'showHelpOverlay'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            console.log('Help overlay shown');
        } catch (error) {
            console.error('Error showing help overlay:', error);
            this.showNotification('Błąd podczas wyświetlania pomocy', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Send notification to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                console.warn('Error querying tabs:', chrome.runtime.lastError.message);
                return;
            }
            
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'showNotification',
                    message: message,
                    type: type
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Silently ignore - content script might not be injected yet
                        console.debug('Content script not available for notification:', chrome.runtime.lastError.message);
                    }
                });
            }
        });
    }

    async updateKeyboardShortcuts() {
        // Update the shortcuts when profiles change
        await this.saveProfiles();
    }

    // Context Menus
    setupContextMenus() {
        if (!this.contextMenusEnabled) {
            console.log('Context menus disabled, skipping setup');
            return;
        }
        
        try {
            chrome.contextMenus.create({
                id: 'autofill-main',
                title: 'AutoFill Profile',
                contexts: ['editable']
            });

            chrome.contextMenus.create({
                id: 'autofill-last-used',
                title: 'Użyj ostatnio używanego profilu',
                parentId: 'autofill-main',
                contexts: ['editable']
            });

            chrome.contextMenus.create({
                id: 'autofill-separator',
                type: 'separator',
                parentId: 'autofill-main',
                contexts: ['editable']
            });

            // Note: profiles will be added when they are loaded/updated

            chrome.contextMenus.onClicked.addListener((info, tab) => {
                this.handleContextMenuClick(info, tab);
            });
            
            this.contextMenusCreated = true;
            console.log('Context menus created successfully');
        } catch (error) {
            console.error('Error setting up context menus:', error);
            console.log('Disabling context menus due to persistent errors');
            this.contextMenusCreated = false;
            this.contextMenusEnabled = false;
        }
    }

    updateContextMenuProfiles() {
        if (!this.contextMenusEnabled) {
            return;
        }
        
        // Debounce multiple calls to prevent infinite loops
        if (this.contextMenuUpdateTimeout) {
            clearTimeout(this.contextMenuUpdateTimeout);
        }
        
        this.contextMenuUpdateTimeout = setTimeout(() => {
            this.doUpdateContextMenuProfiles();
        }, 500); // 500ms debounce
    }
    
    doUpdateContextMenuProfiles() {
        // Don't update if context menus weren't created successfully
        if (!this.contextMenusCreated) {
            console.warn('Context menus not created, skipping profile update');
            return;
        }
        
        try {
            // First, get list of existing menu items to avoid errors
            chrome.contextMenus.removeAll(() => {
                if (chrome.runtime.lastError) {
                    console.warn('Error removing context menus:', chrome.runtime.lastError.message);
                    this.contextMenusCreated = false;
                    return;
                }
                
                // Recreate base menus
                this.recreateBaseContextMenus();
            });
        } catch (error) {
            console.error('Error updating context menu profiles:', error);
            this.contextMenusCreated = false;
        }
    }
    
    recreateBaseContextMenus() {
        try {
            // Recreate main menu structure
            chrome.contextMenus.create({
                id: 'autofill-main',
                title: 'AutoFill Profile',
                contexts: ['editable']
            });

            chrome.contextMenus.create({
                id: 'autofill-last-used',
                title: 'Użyj ostatnio używanego profilu',
                parentId: 'autofill-main',
                contexts: ['editable']
            });

            chrome.contextMenus.create({
                id: 'autofill-separator',
                type: 'separator',
                parentId: 'autofill-main',
                contexts: ['editable']
            });
            
            // Add current profiles (limit to 10)
            this.profiles.slice(0, 10).forEach(profile => {
                try {
                    chrome.contextMenus.create({
                        id: `profile-${profile.id}`,
                        title: profile.name,
                        parentId: 'autofill-main',
                        contexts: ['editable']
                    });
                } catch (error) {
                    console.warn('Failed to create context menu for profile:', profile.name, error);
                }
            });
        } catch (error) {
            console.error('Error recreating base context menus:', error);
            this.contextMenusCreated = false;
        }
    }

    async handleContextMenuClick(info, tab) {
        if (info.menuItemId === 'autofill-last-used') {
            await this.fillWithLastUsedProfile(tab.id);
        } else if (info.menuItemId.startsWith('profile-')) {
            const profileId = info.menuItemId.replace('profile-', '');
            await this.fillFormWithProfile(profileId, tab.id);
        }
    }

    // Storage Management
    setupStorageListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.autofillProfiles) {
                this.profiles = changes.autofillProfiles.newValue || [];
                // Only update context menus if they were successfully set up
                if (this.contextMenusCreated) {
                    this.updateContextMenuProfiles();
                }
            }
        });
    }

    async importProfiles(newProfiles) {
        if (!Array.isArray(newProfiles)) {
            throw new Error('Invalid profiles data');
        }

        // Validate and merge profiles
        const validProfiles = newProfiles.filter(profile => 
            profile.name && profile.fields && Array.isArray(profile.fields)
        );

        validProfiles.forEach(profile => {
            profile.id = this.generateProfileId();
            profile.importedAt = Date.now();
        });

        this.profiles = [...this.profiles, ...validProfiles];
        await this.saveProfiles();
        
        return validProfiles.length;
    }

    async clearAllData() {
        this.profiles = [];
        await new Promise((resolve) => {
            chrome.storage.local.clear(resolve);
        });
    }

    // Utility Methods
    async getActiveTab() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
    }

    broadcastProfilesUpdate() {
        // Notify all popups about profile changes
        chrome.runtime.sendMessage({
            action: 'profilesUpdated',
            profiles: this.profiles
        }).catch(() => {
            // Ignore errors if no popup is open
        });
    }

    // Statistics and Analytics
    getProfileStats() {
        return {
            totalProfiles: this.profiles.length,
            totalFields: this.profiles.reduce((sum, p) => sum + p.fields.length, 0),
            mostUsedProfile: this.profiles
                .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0],
            profilesWithShortcuts: this.profiles.filter(p => p.shortcut).length
        };
    }
}

// Initialize background script
const autoFillBackground = new AutoFillBackground();

} // End of Chrome APIs check
