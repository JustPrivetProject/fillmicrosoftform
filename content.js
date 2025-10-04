// Google Forms AutoFill - Content Script v3.0
// Minimal implementation with core functionality

(function() {
    'use strict';

    console.log('AutoFill Content Script v3.0 loaded');

    // Core AutoFill class
    class AutoFillContentScript {
        constructor() {
            this.profiles = [];
            this.currentProfile = null;
            this.isProcessing = false;
            
            this.init();
        }

        init() {
            this.setupMessageListener();
            this.setupKeyboardShortcuts();
            this.checkForAutoFill();
        }

        // Message handling
        setupMessageListener() {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                try {
                    switch (request.action) {
                        case 'fillForm':
                            this.fillForm(request.profile);
                            sendResponse({ success: true });
                            break;
                        case 'detectFields':
                            const fields = this.detectFields();
                            sendResponse({ success: true, fields });
                            break;
                        default:
                            sendResponse({ success: false, error: 'Unknown action' });
                    }
                } catch (error) {
                    console.error('Content script error:', error);
                    sendResponse({ success: false, error: error.message });
                }
                return true;
            });
        }

        // Keyboard shortcuts
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+Alt+1,2,3... for profiles
                if (e.ctrlKey && e.altKey && e.key >= '1' && e.key <= '9') {
                    e.preventDefault();
                    this.executeProfileByShortcut(e.key);
                }
            });
        }

        // Execute profile by shortcut
        executeProfileByShortcut(key) {
            chrome.runtime.sendMessage({ action: 'getProfiles' }, (response) => {
                if (response && response.success && response.profiles) {
                    const profileIndex = parseInt(key) - 1;
                    const profile = response.profiles[profileIndex];
                    if (profile) {
                        this.fillForm(profile);
                    }
                }
            });
        }

        // Main form filling function
        fillForm(profile) {
            if (this.isProcessing) return;
            
            this.isProcessing = true;
            console.log('🚀 Starting form fill with profile:', profile.name);
            console.log('📋 Profile has', profile.fields.length, 'fields to fill');

            let filledCount = 0;
            const totalFields = profile.fields.length;
            const results = [];

            profile.fields.forEach((field, index) => {
                console.log(`\n🔄 Processing field ${index + 1}/${totalFields}:`, field.name);
                console.log('   📝 Type:', field.type);
                console.log('   💾 Value:', field.value);
                
                const element = this.findFieldElement(field);
                if (element) {
                    console.log('   ✅ Element found:', element.tagName, element.type || 'no-type');
                    const success = this.fillField(element, field);
                    if (success) {
                        filledCount++;
                        results.push({ field: field.name, success: true });
                        console.log(`   ✅ Successfully filled: ${field.name}`);
                        this.highlightElement(element);
                    } else {
                        results.push({ field: field.name, success: false });
                        console.warn(`   ❌ Failed to fill: ${field.name}`);
                    }
                } else {
                    results.push({ field: field.name, success: false, error: 'Element not found' });
                    console.warn(`   🚫 Element not found for: ${field.name}`);
                }
            });

            console.log(`\n📊 Form fill completed: ${filledCount}/${totalFields} fields filled`);
            console.log('📈 Success rate:', `${Math.round((filledCount / totalFields) * 100)}%`);
            console.log('🎯 Results summary:', results.map(r => `${r.field}: ${r.success ? '✅' : '❌'}`).join(', '));

            this.showNotification(`Заполнено ${filledCount} из ${totalFields} полей`);
            
            // Auto-click button after delay
            if (filledCount > 0) {
                setTimeout(() => {
                    this.clickNextButton();
                }, 500);
            }

            this.isProcessing = false;
        }

        // Find field element
        findFieldElement(field) {
            console.log(`   🔍 Searching for element: "${field.name}"`);
            
            // Use single reliable approach - search by text
            const xpath = this.generateTextBasedXPath(field.name, field.type);
            console.log(`   🎯 Using XPath: ${xpath}`);
            
            const element = this.findByXPath(xpath);
            if (element) {
                console.log(`   ✅ Found element successfully!`);
                return element;
            }
            
            console.warn(`   🚫 No element found for field: ${field.name}`);
            return null;
        }

        // Generate single reliable XPath based on text search
        generateTextBasedXPath(fieldName, fieldType) {
            const elementType = this.getElementType(fieldType);
            
            // Single reliable approach: find span containing text, then find the input in the same container
            return `//span[contains(normalize-space(text()),"${fieldName}")]//ancestor::div[contains(@data-automation-id,"questionItem")]//${elementType}`;
        }

        // Get element type for XPath
        getElementType(fieldType) {
            switch (fieldType) {
                case 'radio': return 'input[@type="radio"]';
                case 'date': return 'input';
                default: return 'input';
            }
        }


        // Find element by XPath
        findByXPath(xpath) {
            try {
                const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                return result.singleNodeValue;
            } catch (error) {
                return null;
            }
        }

        // Fill field based on type
        fillField(element, field) {
            try {
                switch (field.type) {
                    case 'text':
                        return this.fillTextInput(element, field.value);
                    case 'radio':
                        return this.fillRadioButton(element, field.value);
                    case 'date':
                        return this.fillDateInput(element, field.value);
                    default:
                        return this.fillTextInput(element, field.value);
                }
            } catch (error) {
                console.error('Error filling field:', error);
                return false;
            }
        }

        // Fill text input
        fillTextInput(element, value) {
            console.log(`   ✍️ Filling text input with: "${value}"`);
            element.focus();
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`   ✅ Text input filled successfully`);
            return true;
        }

        // Fill radio button
        fillRadioButton(element, value) {
            console.log(`   🔘 Looking for radio option: "${value}"`);
            // Find radio option with matching text
            const container = element.closest('div[role="radiogroup"]') || element.parentElement;
            const options = container.querySelectorAll('input[type="radio"]');
            
            for (const option of options) {
                const label = option.closest('label');
                if (label && label.textContent.includes(value)) {
                    console.log(`   ✅ Found radio option: "${label.textContent.trim()}"`);
                    option.checked = true;
                    option.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`   ✅ Radio button selected successfully`);
                    return true;
                }
            }
            console.log(`   ❌ Radio option not found: "${value}"`);
            return false;
        }



        // Fill date input
        fillDateInput(element, value) {
            console.log(`   📅 Filling date input with: "${value}"`);
            
            try {
                // Get placeholder to determine date format
                const placeholder = element.placeholder || '';
                console.log(`   📅 Placeholder: "${placeholder}"`);
                
                // Format the date according to placeholder
                const formattedDate = this.formatDateByPlaceholder(value, placeholder);
                console.log(`   📅 Formatted date: "${formattedDate}"`);
                
                // Click to open calendar first (many date pickers require this)
                console.log(`   📅 Clicking to open calendar...`);
                element.click();
                
                // Wait a bit for calendar to open
                setTimeout(() => {
                    // Focus the element
                    element.focus();
                    element.select();
                    
                    // Clear existing value
                    element.value = '';
                    
                    // Set the formatted value
                    element.value = formattedDate;
                    
                    // Trigger basic events
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    console.log(`   ✅ Date input filled successfully with: "${formattedDate}"`);
                }, 100);
                
                return true;
                
            } catch (error) {
                console.error('❌ Error filling date input:', error);
                return false;
            }
        }

        // Format date according to placeholder
        formatDateByPlaceholder(dateValue, placeholder) {
            if (!dateValue) return '';
            
            // Extract format from placeholder (e.g., "M/d/yyyy" from "Please input date (M/d/yyyy)")
            const formatMatch = placeholder.match(/\(([^)]+)\)/);
            if (!formatMatch) {
                console.log(`   📅 No format found in placeholder, using original value`);
                return dateValue;
            }
            
            const format = formatMatch[1];
            console.log(`   📅 Detected format: "${format}"`);
            
            // Parse input date - try to detect format automatically
            let day, month, year;
            
            if (dateValue.includes('.') || dateValue.includes('/') || dateValue.includes('-')) {
                const parts = dateValue.split(/[.\/-]/).filter(part => part.length > 0);
                if (parts.length === 3) {
                    // Try to detect if it's MM/dd/yyyy or dd/MM/yyyy format
                    const firstPart = parseInt(parts[0]);
                    const secondPart = parseInt(parts[1]);
                    
                    if (firstPart > 12 && secondPart <= 12) {
                        // First part is day, second is month (dd/MM/yyyy)
                        day = parts[0].padStart(2, '0');
                        month = parts[1].padStart(2, '0');
                        year = parts[2];
                    } else if (firstPart <= 12 && secondPart > 12) {
                        // First part is month, second is day (MM/dd/yyyy)
                        month = parts[0].padStart(2, '0');
                        day = parts[1].padStart(2, '0');
                        year = parts[2];
                    } else {
                        // Ambiguous case - assume MM/dd/yyyy (US format)
                        month = parts[0].padStart(2, '0');
                        day = parts[1].padStart(2, '0');
                        year = parts[2];
                    }
                } else {
                    return dateValue; // Return original if can't parse
                }
            } else {
                return dateValue; // Return original if no separators
            }
            
            // Convert to target format
            let result = format;
            result = result.replace(/M+/g, month);
            result = result.replace(/d+/g, day);
            result = result.replace(/y+/g, year);
            
            console.log(`   📅 Converted "${dateValue}" to "${result}" using format "${format}"`);
            return result;
        }

        // Click next button
        clickNextButton() {
            console.log('🔍 Looking for Next or Submit button...');
            const buttons = document.querySelectorAll('button, input[type="submit"]');
            console.log(`📋 Found ${buttons.length} buttons on page`);
            
            for (const button of buttons) {
                const text = button.textContent.toLowerCase();
                console.log(`   🔍 Checking button: "${button.textContent.trim()}"`);
                
                // Check for Next button
                if (text.includes('next') || text.includes('dalej') || text.includes('następny')) {
                    console.log('✅ Found Next button, clicking...');
                    button.click();
                    this.showNotification('Переход к следующей странице...');
                    console.log('✅ Next button clicked successfully');
                    return true;
                }
                
                // Check for Submit button (for last profile)
                if (text.includes('submit') || text.includes('отправить') || text.includes('wyślij') || text.includes('wyslij')) {
                    console.log('✅ Found Submit button (last profile), clicking...');
                    button.click();
                    this.showNotification('Отправка формы (последний профиль)...');
                    console.log('✅ Submit button clicked successfully');
                    return true;
                }
            }
            console.log('❌ No Next or Submit button found');
            return false;
        }

        // Detect form fields
        detectFields() {
            console.log('🔍 Starting form field detection...');
            const fields = [];
            const inputs = document.querySelectorAll('input, textarea, select');
            console.log(`📋 Found ${inputs.length} input elements on page`);
            
            let visibleCount = 0;
            inputs.forEach((input, index) => {
                if (this.isVisible(input)) {
                    visibleCount++;
                    const label = this.findLabel(input);
                    const fieldData = {
                        name: label || `Field ${index + 1}`,
                        type: this.getFieldType(input),
                        value: ''
                    };
                    console.log(`   ✅ Field ${visibleCount}: "${fieldData.name}" (${fieldData.type})`);
                    fields.push(fieldData);
                }
            });
            
            console.log(`📊 Detection complete: ${visibleCount} visible fields found`);
            return fields;
        }

        // Find label for input
        findLabel(input) {
            // Try label[for] attribute
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) return label.textContent.trim();
            }
            
            // Try parent label
            const parentLabel = input.closest('label');
            if (parentLabel) return parentLabel.textContent.trim();
            
            // Try previous sibling
            const prevSibling = input.previousElementSibling;
            if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.tagName === 'SPAN')) {
                return prevSibling.textContent.trim();
            }
            
            return null;
        }

        // Get field type
        getFieldType(element) {
            if (element.type === 'radio') return 'radio';
            if (element.type === 'date') return 'date';
            return 'text';
        }

        // Generate selector for element (legacy method - not used anymore)
        generateSelector(element) {
            if (element.id) return `#${element.id}`;
            if (element.name) return `[name="${element.name}"]`;
            return element.tagName.toLowerCase();
        }

        // Check if element is visible
        isVisible(element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   !element.disabled;
        }

        // Highlight element
        highlightElement(element) {
            const originalStyle = element.style.boxShadow;
            element.style.boxShadow = '0 0 10px #4CAF50';
            setTimeout(() => {
                element.style.boxShadow = originalStyle;
            }, 1000);
        }

        // Show notification
        showNotification(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 1500);
        }

        // Check for auto-fill
        checkForAutoFill() {
            chrome.runtime.sendMessage({ action: 'getProfiles' }, (response) => {
                if (response && response.success && response.profiles) {
                    // Check for Microsoft Forms auto-fill profiles
                    const autoFillProfile = response.profiles.find(p => p.autoFillOfficeForms);
                    if (autoFillProfile && this.isMicrosoftFormsSite()) {
                        console.log('🚀 Auto-filling Microsoft Forms with profile:', autoFillProfile.name);
                        this.waitForFormElements(() => {
                            this.fillFormWithChain(autoFillProfile);
                        });
                    }
                }
            });
        }

        // Wait for form elements to be available
        waitForFormElements(callback, maxAttempts = 10, attempt = 0) {
            const formElements = document.querySelectorAll('input, textarea, select');
            const hasVisibleElements = Array.from(formElements).some(el => this.isVisible(el));
            
            if (hasVisibleElements || attempt >= maxAttempts) {
                if (hasVisibleElements) {
                    console.log('✅ Form elements found, starting auto-fill');
                } else {
                    console.log('⚠️ Form elements not found after maximum attempts, starting anyway');
                }
                callback();
            } else {
                console.log(`⏳ Waiting for form elements... (attempt ${attempt + 1}/${maxAttempts})`);
                setTimeout(() => {
                    this.waitForFormElements(callback, maxAttempts, attempt + 1);
                }, 200);
            }
        }

        // Check if current site is Microsoft Forms
        isMicrosoftFormsSite() {
            const hostname = window.location.hostname;
            return hostname.includes('forms.office') || 
                   hostname.includes('forms.cloud.microsoft') ||
                   hostname.includes('forms.microsoft');
        }

        // Fill form with chain support
        fillFormWithChain(profile) {
            if (this.isProcessing) return;
            
            this.isProcessing = true;
            console.log('🚀 Starting form fill with profile:', profile.name);
            console.log('📋 Profile has', profile.fields.length, 'fields to fill');

            let filledCount = 0;
            const totalFields = profile.fields.length;
            const results = [];

            profile.fields.forEach((field, index) => {
                console.log(`\n🔄 Processing field ${index + 1}/${totalFields}:`, field.name);
                console.log('   📝 Type:', field.type);
                console.log('   💾 Value:', field.value);
                
                const element = this.findFieldElement(field);
                if (element) {
                    console.log('   ✅ Element found:', element.tagName, element.type || 'no-type');
                    const success = this.fillField(element, field);
                    if (success) {
                        filledCount++;
                        results.push({ field: field.name, success: true });
                        console.log(`   ✅ Successfully filled: ${field.name}`);
                        this.highlightElement(element);
                    } else {
                        results.push({ field: field.name, success: false });
                        console.warn(`   ❌ Failed to fill: ${field.name}`);
                    }
                } else {
                    results.push({ field: field.name, success: false, error: 'Element not found' });
                    console.warn(`   🚫 Element not found for: ${field.name}`);
                }
            });

            console.log(`\n📊 Form fill completed: ${filledCount}/${totalFields} fields filled`);
            console.log('📈 Success rate:', `${Math.round((filledCount / totalFields) * 100)}%`);
            console.log('🎯 Results summary:', results.map(r => `${r.field}: ${r.success ? '✅' : '❌'}`).join(', '));

            this.showNotification(`Заполнено ${filledCount} из ${totalFields} полей`);
            
            // Auto-click button after delay
            if (filledCount > 0) {
                setTimeout(() => {
                    this.clickNextButton();
                    
                    // If profile has next profile, continue chain
                    if (profile.nextProfileId) {
                        setTimeout(() => {
                            this.continueChain(profile.nextProfileId);
                        }, 300); // Short delay for page transition
                    }
                }, 500);
            }

            this.isProcessing = false;
        }

        // Continue chain with next profile
        continueChain(nextProfileId) {
            console.log('🔗 Continuing chain with next profile:', nextProfileId);
            chrome.runtime.sendMessage({ action: 'getProfiles' }, (response) => {
                if (response && response.success && response.profiles) {
                    const nextProfile = response.profiles.find(p => p.id === nextProfileId);
                    if (nextProfile) {
                        console.log('🔗 Found next profile in chain:', nextProfile.name);
                        this.fillFormWithChain(nextProfile);
                    } else {
                        console.warn('🔗 Next profile not found in chain:', nextProfileId);
                    }
                }
            });
        }
    }

    // Initialize
    new AutoFillContentScript();

})();