// Google Forms AutoFill - Advanced Profile Management

// Check if Chrome Extension APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Chrome Extension APIs not available');
    document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px;">
                <h3>Ошибка расширения</h3>
                <p>Chrome Extension APIs недоступны. Попробуйте перезагрузить расширение.</p>
                <button id="errorReloadBtn" style="padding: 8px 16px; margin-top: 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Обновить</button>
            </div>
        `;
        
        // Add event listener for reload button
        document.getElementById('errorReloadBtn').addEventListener('click', () => {
            location.reload();
        });
    });
} else {

class AutoFillManager {
    constructor() {
        this.profiles = [];
        this.currentProfile = null;
        this.currentField = null;
        this.editingFieldIndex = -1;
        this.osInfo = this.detectOperatingSystem();
        
        this.init();
    }

    /**
     * Detect the operating system
     * @returns {Object} - Object with OS information
     */
    detectOperatingSystem() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        
        let os = 'unknown';
        let isMac = false;
        let isWindows = false;
        let isLinux = false;
        let modifierKey = 'Ctrl'; // Default modifier
        let altKey = 'Alt';       // Default alt key

        // Detect Mac
        if (/Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent)) {
            os = 'mac';
            isMac = true;
            modifierKey = 'Cmd';
            altKey = 'Option';
        }
        // Detect Windows
        else if (/Win/.test(platform) || /Windows/.test(userAgent)) {
            os = 'windows';
            isWindows = true;
            modifierKey = 'Ctrl';
            altKey = 'Alt';
        }
        // Detect Linux
        else if (/Linux/.test(platform) || /X11/.test(platform)) {
            os = 'linux';
            isLinux = true;
            modifierKey = 'Ctrl';
            altKey = 'Alt';
        }

        console.log('Detected OS in popup:', { os, isMac, isWindows, isLinux, modifierKey, altKey });

        return {
            os,
            isMac,
            isWindows,
            isLinux,
            modifierKey,
            altKey,
            platform
        };
    }
    
    async init() {
        this.bindEvents();
        this.updateKeyboardShortcutOptions();
        await this.loadProfiles();
        this.showMainView();
        
        // Show OS-specific welcome message on first load
        setTimeout(() => {
            this.showOSWelcomeMessage();
        }, 500);
    }

    /**
     * Update keyboard shortcut options - use Ctrl+Alt+ as primary format
     */
    updateKeyboardShortcutOptions() {
        const shortcutSelect = document.getElementById('keyboardShortcut');
        
        // Clear existing options
        shortcutSelect.innerHTML = '';
        
        // Add "no shortcut" option
        const noShortcutOption = document.createElement('option');
        noShortcutOption.value = '';
        noShortcutOption.textContent = 'Bez skrótu klawiszowego';
        shortcutSelect.appendChild(noShortcutOption);
        
        // Add number shortcuts (1-9) using Ctrl+Alt format
        for (let i = 1; i <= 9; i++) {
            const option = document.createElement('option');
            option.value = `Ctrl+Alt+${i}`;
            option.textContent = `Ctrl+Alt+${i}`;
            shortcutSelect.appendChild(option);
        }
        
        // Add 0
        const zeroOption = document.createElement('option');
        zeroOption.value = `Ctrl+Alt+0`;
        zeroOption.textContent = `Ctrl+Alt+0`;
        shortcutSelect.appendChild(zeroOption);
        
        // Add letter shortcuts (Q-P) using Ctrl+Alt format
        const letters = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
        letters.forEach(letter => {
            const option = document.createElement('option');
            option.value = `Ctrl+Alt+${letter}`;
            option.textContent = `Ctrl+Alt+${letter}`;
            shortcutSelect.appendChild(option);
        });
        
        // Update the label to show the correct format
        const label = document.querySelector('label[for="keyboardShortcut"]');
        if (label) {
            label.textContent = `Skrót klawiszowy (Ctrl+Alt+):`;
        }
        
        console.log(`Updated keyboard shortcuts to use Ctrl+Alt+ format for all platforms`);
    }
    
    bindEvents() {
        // Main view events
        document.getElementById('createProfileBtn').addEventListener('click', () => this.createNewProfile());
        document.getElementById('searchProfiles').addEventListener('input', (e) => this.searchProfiles(e.target.value));
        document.getElementById('exportBtn').addEventListener('click', () => this.exportProfiles());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importProfiles(e));
        document.getElementById('deleteAllBtn').addEventListener('click', () => this.deleteAllProfiles());
        
        // Editor view events
        document.getElementById('backToMain').addEventListener('click', () => this.showMainView());
        document.getElementById('saveProfile').addEventListener('click', () => this.saveProfile());

        document.getElementById('deleteProfile').addEventListener('click', () => this.deleteProfile());
        document.getElementById('addFieldBtn').addEventListener('click', () => this.showFieldModal());
        // Keyboard shortcut is now a simple select, no special handling needed
        
        // Modal events
        document.getElementById('saveField').addEventListener('click', () => this.saveField());
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.hideModal());
        });
        document.getElementById('detectField').addEventListener('click', () => this.detectField());
        
        // Field type change handler
        document.getElementById('fieldType').addEventListener('change', (e) => this.handleFieldTypeChange(e));
        
        // Show selector checkbox handler
        document.getElementById('showSelectorCheckbox').addEventListener('change', () => this.handleSelectorCheckboxChange());
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e));
    }
    
    async loadProfiles() {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getProfiles' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Runtime error loading profiles:', chrome.runtime.lastError.message);
                        this.profiles = [];
                        this.showConnectionError();
                        resolve();
                        return;
                    }
                    
                    if (response && response.success) {
                        this.profiles = response.profiles || [];
                        this.renderProfilesList();
                    } else {
                        console.error('Failed to load profiles:', response?.error || 'Unknown error');
                        this.profiles = [];
                        this.showLoadError(response?.error);
                    }
                    resolve();
                });
            } catch (error) {
                console.error('Exception loading profiles:', error);
                this.profiles = [];
                this.showLoadError(error.message);
                resolve();
            }
        });
    }
    
    async saveProfiles() {
        // This method is kept for compatibility but now individual profiles are saved
        // through saveProfile method
        return Promise.resolve();
    }
    
    showMainView() {
        document.getElementById('mainView').classList.add('active');
        document.getElementById('editorView').classList.remove('active');
        this.renderProfilesList();
    }
    
    showEditorView() {
        document.getElementById('mainView').classList.remove('active');
        document.getElementById('editorView').classList.add('active');
    }
    
    renderProfilesList() {
        const container = document.getElementById('profilesList');
        const deleteAllBtn = document.getElementById('deleteAllBtn');
        
        if (this.profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Нет профилей</h3>
                    <p>Создайте свой первый профиль автозаполнения</p>
                    <button class="btn btn-create" id="createNewProfileBtn">+ Nowy profil</button>
                </div>
            `;
            
            // Hide delete all button when no profiles
            if (deleteAllBtn) {
                deleteAllBtn.style.display = 'none';
            }
            
            // Add event listener for create button
            document.getElementById('createNewProfileBtn').addEventListener('click', () => {
                this.createNewProfile();
            });
            return;
        }
        
        // Show delete all button when profiles exist
        if (deleteAllBtn) {
            deleteAllBtn.style.display = 'inline-flex';
        }
        
        container.innerHTML = this.profiles.map((profile, index) => {
            const nextProfile = profile.nextProfileId ? this.profiles.find(p => p.id === profile.nextProfileId) : null;
            
            return `
            <div class="profile-item ${profile.nextProfileId ? 'has-chain' : ''}" data-profile-index="${index}">
                <div class="profile-header">
                    <span class="profile-name">${this.escapeHtml(profile.name)}</span>
                    ${profile.shortcut ? `<span class="profile-shortcut">${this.escapeHtml(profile.shortcut)}</span>` : ''}
                </div>
                ${profile.description ? `<div class="profile-description">${this.escapeHtml(profile.description)}</div>` : ''}
                <div class="profile-info">
                    <span class="profile-fields">${profile.fields.length} полей</span>
                    ${nextProfile ? `<span class="profile-chain">→ ${this.escapeHtml(nextProfile.name)}</span>` : ''}
                </div>
                <div class="profile-actions">
                    <button class="btn btn-secondary btn-small profile-duplicate-btn" data-profile-index="${index}">Копировать</button>
                    <button class="btn btn-delete btn-small profile-delete-btn" data-profile-index="${index}">Удалить</button>
                </div>
            </div>
            `;
        }).join('');
        
        // Add event listeners
        this.attachProfilesEventListeners();
    }
    
    attachProfilesEventListeners() {
        // Profile item click (edit)
        document.querySelectorAll('.profile-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on actions
                if (e.target.closest('.profile-actions')) return;
                const index = parseInt(item.dataset.profileIndex);
                this.editProfile(index);
            });
        });
        

        
        // Duplicate profile buttons
        document.querySelectorAll('.profile-duplicate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.profileIndex);
                this.duplicateProfile(index);
            });
        });
        
        // Delete profile buttons
        document.querySelectorAll('.profile-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.profileIndex);
                this.deleteProfileFromList(index);
            });
        });
    }
    
    createNewProfile() {
        this.currentProfile = {
            id: Date.now().toString(),
            name: '',
            description: '',
            shortcut: '',
            nextProfileId: null,
            fields: []
        };
        this.showEditorView();
        this.renderProfileEditor();
        document.getElementById('deleteProfile').style.display = 'none';
        document.getElementById('editorTitle').textContent = 'Nowy profil';
    }
    
    editProfile(index) {
        this.currentProfile = { ...this.profiles[index] };
        this.currentProfile.originalIndex = index;
        this.showEditorView();
        this.renderProfileEditor();
        document.getElementById('deleteProfile').style.display = 'block';
        document.getElementById('editorTitle').textContent = 'Редактировать профиль';
    }
    
    renderProfileEditor() {
        if (!this.currentProfile) return;
        
        document.getElementById('profileName').value = this.currentProfile.name;
        document.getElementById('profileDescription').value = this.currentProfile.description;
        document.getElementById('keyboardShortcut').value = this.currentProfile.shortcut || '';
        
        // Populate next profile dropdown
        this.populateNextProfileDropdown();
        document.getElementById('nextProfile').value = this.currentProfile.nextProfileId || '';
        
        this.renderFieldsList();
    }
    
    populateNextProfileDropdown() {
        const nextProfileSelect = document.getElementById('nextProfile');
        
        // Clear existing options except the first one
        nextProfileSelect.innerHTML = '<option value="">Bez następnego profilu</option>';
        
        // Add all other profiles as options (exclude current profile)
        this.profiles.forEach(profile => {
            if (profile.id !== this.currentProfile.id) {
                const option = document.createElement('option');
                option.value = profile.id;
                option.textContent = profile.name;
                nextProfileSelect.appendChild(option);
            }
        });
    }

    wouldCreateCircularChain(profileId, nextProfileId, visited = new Set()) {
        // Check if we've already visited this profile (circular dependency)
        if (visited.has(nextProfileId)) {
            return true;
        }

        // Add current profile to visited set
        visited.add(nextProfileId);

        // Find the next profile
        const nextProfile = this.profiles.find(p => p.id === nextProfileId);
        if (!nextProfile || !nextProfile.nextProfileId) {
            return false; // No circular dependency
        }

        // If the next profile points back to the original profile, it's circular
        if (nextProfile.nextProfileId === profileId) {
            return true;
        }

        // Recursively check the chain
        return this.wouldCreateCircularChain(profileId, nextProfile.nextProfileId, visited);
    }
    
    renderFieldsList() {
        const container = document.getElementById('fieldsList');
        
        if (this.currentProfile.fields.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Нет полей для заполнения</p>
                    <button class="btn btn-create btn-small" id="addFirstFieldBtn">+ Добавить первое поле</button>
                </div>
            `;
            
            // Add event listener for add first field button
            document.getElementById('addFirstFieldBtn').addEventListener('click', () => {
                this.showFieldModal();
            });
            return;
        }
        
        container.innerHTML = this.currentProfile.fields.map((field, index) => `
            <div class="field-item">
                <div class="field-info">
                    <div class="field-name">${this.escapeHtml(field.name)} (${this.escapeHtml(field.type)})</div>
                    <div class="field-details${field.type === 'button' ? ' button' : (!field.value ? ' empty' : '')}">
                        ${field.type === 'button' ? '🖱️ Кнопка для клика' : `💬 ${this.escapeHtml(field.value || 'Не задано')}`}
                    </div>
                </div>
                <div class="field-actions">
                    <div class="field-order-controls">
                        <button class="btn btn-icon btn-small field-up-btn" data-field-index="${index}" ${index === 0 ? 'disabled' : ''} title="Переместить вверх">↑</button>
                        <button class="btn btn-icon btn-small field-down-btn" data-field-index="${index}" ${index === this.currentProfile.fields.length - 1 ? 'disabled' : ''} title="Переместить вниз">↓</button>
                    </div>
                    <button class="btn btn-secondary btn-small field-edit-btn" data-field-index="${index}">Редактировать</button>
                    <button class="btn btn-delete btn-small field-delete-btn" data-field-index="${index}">Удалить</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for field buttons
        this.attachFieldsEventListeners();
    }
    
    attachFieldsEventListeners() {
        // Field edit buttons
        document.querySelectorAll('.field-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.fieldIndex);
                this.editField(index);
            });
        });
        
        // Field delete buttons
        document.querySelectorAll('.field-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.fieldIndex);
                this.deleteField(index);
            });
        });
        
        // Field move up buttons
        document.querySelectorAll('.field-up-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.fieldIndex);
                this.moveFieldUp(index);
            });
        });
        
        // Field move down buttons
        document.querySelectorAll('.field-down-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.fieldIndex);
                this.moveFieldDown(index);
            });
        });
    }
    
    showFieldModal(fieldIndex = -1) {
        this.editingFieldIndex = fieldIndex;
        const modal = document.getElementById('fieldModal');
        const isEditing = fieldIndex >= 0;
        
        // Clear temporary selector value
        this.tempSelectorValue = undefined;
        
        document.getElementById('fieldModalTitle').textContent = isEditing ? 'Редактировать поле' : 'Добавить поле';
        
        if (isEditing) {
            const field = this.currentProfile.fields[fieldIndex];
            document.getElementById('fieldName').value = field.name;
            document.getElementById('fieldType').value = field.type;
            document.getElementById('fieldSelector').value = field.selector || '';
            document.getElementById('fieldValue').value = field.value;
            
            // Set checkbox state based on whether selector exists
            const showSelector = !!(field.selector && field.selector.trim());
            document.getElementById('showSelectorCheckbox').checked = showSelector;
        } else {
            document.getElementById('fieldName').value = '';
            document.getElementById('fieldType').value = 'text';
            document.getElementById('fieldSelector').value = '';
            document.getElementById('fieldValue').value = '';
            document.getElementById('showSelectorCheckbox').checked = false;
        }
        
        // Update visibility of value field based on type
        this.handleFieldTypeChange({ target: { value: document.getElementById('fieldType').value } });
        
        // Update visibility of selector field based on checkbox
        this.handleSelectorCheckboxChange();
        
        modal.classList.add('active');
    }
    
    hideModal() {
        document.getElementById('fieldModal').classList.remove('active');
        this.editingFieldIndex = -1;
        // Clear temporary selector value
        this.tempSelectorValue = undefined;
    }
    
    handleFieldTypeChange(e) {
        const fieldType = e.target.value;
        const valueGroup = document.querySelector('#fieldValue').closest('.input-group');
        
        if (fieldType === 'button') {
            // Hide value field for buttons
            valueGroup.style.display = 'none';
        } else {
            // Show value field for other types
            valueGroup.style.display = 'block';
        }
    }
    
    handleSelectorCheckboxChange() {
        const checkbox = document.getElementById('showSelectorCheckbox');
        const selectorGroup = document.getElementById('selectorGroup');
        const selectorInput = document.getElementById('fieldSelector');
        
        if (checkbox.checked) {
            selectorGroup.style.display = 'block';
            // Restore saved value if it exists
            if (this.tempSelectorValue !== undefined) {
                selectorInput.value = this.tempSelectorValue;
            }
        } else {
            // Save current value before hiding
            this.tempSelectorValue = selectorInput.value;
            selectorGroup.style.display = 'none';
        }
    }
    
    saveField() {
        const fieldType = document.getElementById('fieldType').value;
        const showSelectorChecked = document.getElementById('showSelectorCheckbox').checked;
        const field = {
            name: document.getElementById('fieldName').value.trim(),
            type: fieldType,
            selector: showSelectorChecked ? document.getElementById('fieldSelector').value.trim() : '',
            value: fieldType === 'button' ? '' : document.getElementById('fieldValue').value,
            required: false
        };
        
        if (!field.name) {
            this.showStatus('Введите название поля', 'error');
            return;
        }
        
        if (this.editingFieldIndex >= 0) {
            this.currentProfile.fields[this.editingFieldIndex] = field;
        } else {
            this.currentProfile.fields.push(field);
        }
        
        this.renderFieldsList();
        this.hideModal();
        this.showStatus('Поле сохранено', 'success');
    }
    
    editField(index) {
        this.showFieldModal(index);
    }
    
    deleteField(index) {
        if (confirm('Вы уверены, что хотите удалить это поле?')) {
            this.currentProfile.fields.splice(index, 1);
            this.renderFieldsList();
            this.showStatus('Поле удалено', 'info');
        }
    }
    
    moveFieldUp(index) {
        if (index > 0) {
            const fields = this.currentProfile.fields;
            // Swap with previous element
            [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
            this.renderFieldsList();
            this.showStatus('Поле перемещено вверх', 'success');
        }
    }
    
    moveFieldDown(index) {
        const fields = this.currentProfile.fields;
        if (index < fields.length - 1) {
            // Swap with next element
            [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
            this.renderFieldsList();
            this.showStatus('Поле перемещено вниз', 'success');
        }
    }
    
    async saveProfile() {
        const name = document.getElementById('profileName').value.trim();
        if (!name) {
            this.showStatus('Введите название профиля', 'error');
            return;
        }
        
        this.currentProfile.name = name;
        this.currentProfile.description = document.getElementById('profileDescription').value.trim();
        const selectedShortcut = document.getElementById('keyboardShortcut').value;
        
        // Check if shortcut is already used by another profile
        if (selectedShortcut) {
            const existingProfile = this.profiles.find(p => p.shortcut === selectedShortcut && p.id !== this.currentProfile?.id);
            if (existingProfile) {
                this.showStatus(`Skrót ${selectedShortcut} уже используется профилем "${existingProfile.name}"`, 'error');
                return;
            }
        }

        // Get next profile selection
        const nextProfileId = document.getElementById('nextProfile').value;

        // Check for circular chains
        if (nextProfileId && this.wouldCreateCircularChain(this.currentProfile.id, nextProfileId)) {
            this.showStatus('Nie można utworzyć cyklicznego łańcucha profili', 'error');
            return;
        }
        
        this.currentProfile.shortcut = selectedShortcut;
        this.currentProfile.nextProfileId = nextProfileId || null;
        
        // Send to background script
        chrome.runtime.sendMessage({
            action: 'saveProfile',
            profile: this.currentProfile
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Runtime error saving profile:', chrome.runtime.lastError.message);
                this.showStatus('Ошибка соединения при сохранении', 'error');
                return;
            }
            
            if (response && response.success) {
                this.showStatus('Профиль сохранён', 'success');
                
                // Reload profiles and return to main view
                setTimeout(async () => {
                    await this.loadProfiles();
                    this.showMainView();
                }, 1000);
            } else {
                this.showStatus('Ошибка при сохранении профиля', 'error');
                console.error('Save profile error:', response?.error || 'Unknown error');
            }
        });
    }
    
    async deleteProfile() {
        if (!confirm('Вы уверены, что хотите удалить этот профиль?')) return;
        
        if (this.currentProfile.id) {
            chrome.runtime.sendMessage({
                action: 'deleteProfile',
                profileId: this.currentProfile.id
            }, (response) => {
                if (response && response.success) {
                    this.showStatus('Профиль удалён', 'info');
                    this.loadProfiles().then(() => {
                        this.showMainView();
                    });
                } else {
                    this.showStatus('Ошибка при удалении профиля', 'error');
                }
            });
        }
    }
    
    async deleteProfileFromList(index) {
        if (!confirm('Вы уверены, что хотите удалить этот профиль?')) return;
        
        const profile = this.profiles[index];
        if (profile && profile.id) {
            chrome.runtime.sendMessage({
                action: 'deleteProfile',
                profileId: profile.id
            }, (response) => {
                if (response && response.success) {
                    this.loadProfiles();
                    this.showStatus('Профиль удалён', 'info');
                } else {
                    this.showStatus('Ошибка при удалении профиля', 'error');
                }
            });
        }
    }
    
    duplicateProfile(index) {
        const profile = this.profiles[index];
        if (profile && profile.id) {
            chrome.runtime.sendMessage({
                action: 'duplicateProfile',
                profileId: profile.id
            }, (response) => {
                if (response && response.success) {
                    this.loadProfiles();
                    this.showStatus('Профиль скопирован', 'success');
                } else {
                    this.showStatus('Ошибка при копировании профиля', 'error');
                }
            });
        }
    }
    
    async deleteAllProfiles() {
        // Check if there are profiles to delete
        if (!this.profiles || this.profiles.length === 0) {
            this.showStatus('Нет профилей для удаления', 'info');
            return;
        }
        
        const profileCount = this.profiles.length;
        
        // Simple confirmation dialog
        if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить ВСЕ профили (${profileCount} штук)?\n\nЭто действие НЕЛЬЗЯ отменить!`)) {
            this.showStatus('Удаление отменено', 'info');
            return;
        }
        
        this.showStatus('Удаление всех профилей...', 'info');
        
        try {
            // Send request to background script to delete all profiles
            chrome.runtime.sendMessage({
                action: 'deleteAllProfiles'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Runtime error deleting all profiles:', chrome.runtime.lastError.message);
                    this.showStatus('Ошибка соединения при удалении', 'error');
                    return;
                }
                
                if (response && response.success) {
                    this.showStatus(`Все профили удалены (${response.deletedCount} штук)`, 'success');
                    // Reload to show empty state
                    this.loadProfiles();
                } else {
                    this.showStatus('Ошибка при удалении профилей', 'error');
                    console.error('Delete all profiles error:', response?.error || 'Unknown error');
                }
            });
        } catch (error) {
            console.error('Exception deleting all profiles:', error);
            this.showStatus('Ошибка при удалении профилей', 'error');
        }
    }

    

    
    fillForm(profileId) {
        chrome.runtime.sendMessage({
            action: 'fillForm',
            profileId: profileId
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Runtime error filling form:', chrome.runtime.lastError.message);
                this.showStatus('Ошибка соединения при заполнении', 'error');
                return;
            }
            
            if (response && response.success) {
                this.showStatus(`Заполнено ${response.filled} из ${response.total} полей`, 'success');
                // Don't auto-close popup, let user see the result
                // User can manually close or popup will close automatically when they click elsewhere
            } else {
                this.showStatus('Не найдено полей для заполнения', 'info');
                console.error('Fill form error:', response?.error || 'Unknown error');
            }
        });
    }
    
    // Keyboard shortcuts are now handled by simple select dropdown
    
    handleKeyboardShortcut(e) {
        // Check for profile shortcuts
        const shortcut = this.getKeyboardShortcut(e);
        const profile = this.profiles.find(p => p.shortcut === shortcut);
        if (profile && profile.id) {
            e.preventDefault();
            this.fillForm(profile.id);
        }
    }
    
    getKeyboardShortcut(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.shiftKey) parts.push('Shift');
        if (e.altKey) parts.push('Alt');
        if (e.metaKey) parts.push('Cmd');
        if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
            parts.push(e.key.toUpperCase());
        }
        return parts.join('+');
    }
    
    searchProfiles(query) {
        const items = document.querySelectorAll('.profile-item');
        items.forEach(item => {
            const name = item.querySelector('.profile-name').textContent.toLowerCase();
            const description = item.querySelector('.profile-description')?.textContent?.toLowerCase() || '';
            const matches = name.includes(query.toLowerCase()) || description.includes(query.toLowerCase());
            item.style.display = matches ? 'block' : 'none';
        });
    }
    
    exportProfiles() {
        chrome.runtime.sendMessage({ action: 'exportProfiles' }, (response) => {
            if (response && response.success) {
                const data = JSON.stringify(response.data, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `autofill-profiles-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.showStatus('Профили экспортированы', 'success');
            } else {
                this.showStatus('Ошибка при экспорте', 'error');
            }
        });
    }
    
    importProfiles(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                // Support both legacy format (array) and new format (object with metadata)
                const isValidData = Array.isArray(imported) || 
                                  (imported && imported.profiles && Array.isArray(imported.profiles));
                
                if (isValidData) {
                    chrome.runtime.sendMessage({
                        action: 'importProfiles',
                        profiles: imported
                    }, (response) => {
                        if (response && response.success) {
                            this.loadProfiles();
                            
                            // Show detailed import information
                            const stats = response.result || response;
                            if (typeof stats === 'object' && stats.imported !== undefined) {
                                const chainsText = stats.chains > 0 ? ` (${stats.chains} łańcuchów)` : '';
                                this.showStatus(`✅ Zaimportowano ${stats.imported} profili${chainsText}`, 'success');
                            } else {
                                // Fallback for legacy response format
                                const count = typeof stats === 'number' ? stats : 'profile';
                                this.showStatus(`✅ Zaimportowano ${count} profili`, 'success');
                            }
                        } else {
                            this.showStatus('❌ Ошибка при импорте', 'error');
                        }
                    });
                } else {
                    this.showStatus('Неправильный формат файла', 'error');
                }
            } catch (error) {
                this.showStatus('Ошибка при импорте', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    
    detectField() {
        const fieldName = document.getElementById('fieldName').value.trim();
        if (!fieldName) {
            this.showStatus('Введите название поля przed wykrywaniem', 'error');
            return;
        }
        
        // Generate XPath selector based on field name
        const xpathSelector = this.generateXPathSelector(fieldName);
        document.getElementById('fieldSelector').value = xpathSelector;
        this.showStatus('Wygenerowano selektor XPath', 'success');
    }
    
    generateXPathSelector(fieldName) {
        // Get the selected field type to generate appropriate selector
        const fieldType = document.getElementById('fieldType').value;
        
        // Special handling for radio buttons using the provided selector pattern
        if (fieldType === 'radio') {
            // Return the selector template that will be used with actual option values
            return `//div[.//span[contains(text(), '${fieldName}')]]//label[.//span[contains(text(), 'OPTION_VALUE')]]//input[@type='radio']`;
        }
        
        // Special handling for date fields using the Microsoft DatePicker structure
        if (fieldType === 'date') {
            return `//div[@data-automation-id="questionItem"][.//span[contains(@class, "text-format-content") and contains(text(), "${fieldName}")]]//input[@type="text"][@role="combobox"]`;
        }
        
        const elementSelector = this.getElementSelectorForType(fieldType);
        
        // Generate the main XPath pattern based on your specification
        return `//span[normalize-space(text())="${fieldName}"]//ancestor::div[contains(@data-automation-id,"questionItem")]${elementSelector}`;
    }
    
    getElementSelectorForType(fieldType) {
        switch(fieldType) {
            case 'textarea':
                return '//textarea';
            case 'select':
                return '//select | //div[@role="listbox"]';
            case 'radio':
                return '//label[.//span[contains(text(), "OPTION_VALUE")]]//input[@type="radio"]';
            case 'checkbox':
                return '//div[@role="checkbox"] | //input[@type="checkbox"]';
            case 'date':
                return '//input[@type="date"]';
            case 'number':
                return '//input[@type="number"]';
            case 'email':
                return '//input[@type="email"] | //input[@type="text"]';
            case 'button':
                return '//button | //input[@type="button"] | //input[@type="submit"] | //div[@role="button"]';
            default:
                return '//input';
        }
    }
    
    showStatus(message, type) {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
        
        // For successful form fills, add close button
        if (type === 'success' && message.includes('Заполнено')) {
            statusEl.innerHTML = `
                ${message}
                <button style="margin-left: 10px; padding: 2px 6px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; color: white; cursor: pointer; font-size: 10px;" id="closePopupBtn">Zamknij</button>
            `;
            
            // Add event listener for close button
            document.getElementById('closePopupBtn').addEventListener('click', () => {
                window.close();
            });
        }
        
        // Hide status after delay, except for success messages with close button
        if (!(type === 'success' && message.includes('Заполнено'))) {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Show welcome message about keyboard shortcuts
     */
    showOSWelcomeMessage() {
        this.showStatus(`💻 AutoFill używa Ctrl+Alt+1,2,3... dla profili użytkownika na wszystkich platformach!`, 'info');
    }
    
    showConnectionError() {
        const container = document.getElementById('profilesList');
        container.innerHTML = `
            <div class="empty-state">
                <h3>Ошибка соединения</h3>
                <p>Не удается подключиться к background script. Попробуйте перезагрузить расширение.</p>
                <button class="btn btn-secondary" id="reloadBtn">Обновить</button>
            </div>
        `;
        
        // Add event listener for reload button
        document.getElementById('reloadBtn').addEventListener('click', () => {
            location.reload();
        });
        
        this.showStatus('Ошибка соединения z background script', 'error');
    }
    
    showLoadError(error) {
        const container = document.getElementById('profilesList');
        container.innerHTML = `
            <div class="empty-state">
                <h3>Ошибка загрузки</h3>
                <p>Не удалось загрузить профили: ${error || 'Неизвестная ошибка'}</p>
                <button class="btn btn-secondary" id="retryLoadBtn">Spróbuj ponownie</button>
            </div>
        `;
        
        // Add event listener for retry button
        document.getElementById('retryLoadBtn').addEventListener('click', () => {
            this.loadProfiles();
        });
        
        this.showStatus(`Ошибка загрузки профилей: ${error || 'Неизвестная ошибка'}`, 'error');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
let autoFillManager;
document.addEventListener('DOMContentLoaded', () => {
    autoFillManager = new AutoFillManager();
});

} // End of Chrome APIs check
