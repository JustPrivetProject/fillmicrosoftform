// Google Forms AutoFill - Content Script v2.0
// Focused on XPath-based field detection and filling

(function() {
    'use strict';

    console.log('Google Forms AutoFill Content Script v2.0 loaded');

    // Field type mapping for different input types
    const FIELD_TYPES = {
        text: 'input',
        email: 'input',
        phone: 'input',
        number: 'input',
        textarea: 'textarea',
        radio: 'div[role="radio"]',
        checkbox: 'div[role="checkbox"]',
        select: 'select, div[role="listbox"]',
        date: 'input[type="date"]'
    };

    // Main message listener
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('📨 Action:', request.action);
        
        try {
            switch (request.action) {
                case 'fillFormAdvanced':
                    const result = fillFormWithProfile(request.profile);
                    sendResponse(result);
                    break;
                    
                case 'detectFields':
                    const fields = detectFormFields();
                    sendResponse({ success: true, fields: fields });
                    break;
                    
                case 'showNotification':
                    showFillNotification(request.message, request.type);
                    sendResponse({ success: true });
                    break;
                    
                case 'showDetectedFields':
                    showDetectedFieldsOverlay(request.fields);
                    sendResponse({ success: true });
                    break;
                    
                case 'showHelpOverlay':
                    showKeyboardShortcutsHelp();
                    sendResponse({ success: true });
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

    /**
     * Main function to fill form with profile data
     * @param {Object} profile - Profile containing fields to fill
     */
    function fillFormWithProfile(profile) {
        console.log('🚀 Starting form fill with profile:', profile.name);
        console.log('📋 Profile has', profile.fields.length, 'fields to fill');
        console.log('🌐 Current page URL:', window.location.href);
        console.log('📄 Page title:', document.title);
        
        let fieldsFound = 0;
        let fieldsFilled = 0;
        const results = [];

        // Process each field in the profile
        profile.fields.forEach((fieldConfig, index) => {
            fieldsFound++;
            console.log(`\n🔄 Processing field ${index + 1}/${profile.fields.length}:`, fieldConfig.name);
            console.log('   📝 Type:', fieldConfig.type);
            console.log('   💾 Value:', fieldConfig.value);
            console.log('   🎯 Custom selector:', fieldConfig.selector || 'None (will auto-generate)');
            
            const result = fillSingleField(fieldConfig);
            
            if (result.success) {
                fieldsFilled++;
                results.push({
                    field: fieldConfig.name,
                    success: true,
                    element: result.element,
                    value: fieldConfig.value
                });
                console.log(`   ✅ Successfully filled: ${fieldConfig.name}`);
                console.log('   🎯 Element found:', result.element.tagName, result.element.type || 'no-type');
            } else {
                results.push({
                    field: fieldConfig.name,
                    success: false,
                    error: result.error,
                    value: fieldConfig.value
                });
                console.warn(`   ❌ Failed to fill: ${fieldConfig.name}`);
                console.warn('   🚫 Error:', result.error);
            }
        });

        // Show visual feedback
        if (fieldsFilled > 0) {
            showFillNotification(`Заполнено ${fieldsFilled} z ${fieldsFound} полей`);
            
            // Highlight filled fields
            results.filter(r => r.success).forEach(r => {
                highlightElement(r.element);
            });
        } else {
            showFillNotification('Не найдено полей do wypełnienia', 'warning');
        }

        console.log(`\n📊 Form fill completed: ${fieldsFilled}/${fieldsFound} fields filled`);
        console.log('📈 Success rate:', `${Math.round((fieldsFilled / fieldsFound) * 100)}%`);
        console.log('🎯 Results summary:', results.map(r => `${r.field}: ${r.success ? '✅' : '❌'}`).join(', '));
        
        // Show pattern statistics
        if (window.autofillSuccessfulPatterns) {
            console.log('\n🏆 Successful XPath patterns this session:');
            Object.entries(window.autofillSuccessfulPatterns).forEach(([fieldName, data]) => {
                console.log(`   • ${fieldName}: Pattern ${data.patternIndex} 🎯`);
            });
        }
        
        // Try to click Next button after successful filling with delay
        if (fieldsFilled > 0) {
            setTimeout(() => {
                clickNextButton();
            }, 1000); // 1.5 second delay before clicking Next
        }
        
        return {
            success: fieldsFilled > 0,
            filled: fieldsFilled,
            total: fieldsFound,
            results: results
        };
    }

    /**
     * Fill a single field based on field configuration
     * @param {Object} fieldConfig - Field configuration (name, type, value, selector)
     */
    function fillSingleField(fieldConfig) {
        try {
            const element = findFieldElement(fieldConfig);
            if (!element) {
                return { 
                    success: false, 
                    error: `Element not found for field: ${fieldConfig.name}` 
                };
            }

            const fillResult = fillFieldByType(element, fieldConfig);
            if (fillResult) {
                return { success: true, element: element };
            } else {
                return { 
                    success: false, 
                    error: `Failed to fill field: ${fieldConfig.name}` 
                };
            }
        } catch (error) {
            console.error(`Error filling field ${fieldConfig.name}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Find field element using XPath selector based on field name
     * @param {Object} fieldConfig - Field configuration
     */
    function findFieldElement(fieldConfig) {
        console.log(`\n🔍 Searching for element: "${fieldConfig.name}"`);
        
        // If custom selector is provided, use it first
        if (fieldConfig.selector) {
            console.log('   🎯 Using custom selector:', fieldConfig.selector);
            const element = findElementBySelector(fieldConfig.selector, fieldConfig);
            if (element) {
                console.log('   ✅ Found element with custom selector');
                return element;
            } else {
                console.warn('   ❌ Custom selector failed, falling back to auto-generation');
            }
        }

        // Generate multiple XPath selectors and try each one
        const xpathPatterns = generateXPathSelector(fieldConfig.name, fieldConfig.type);
        console.log(`   🎯 Generated ${xpathPatterns.length} XPath patterns for: ${fieldConfig.name}`);
        
        for (let i = 0; i < xpathPatterns.length; i++) {
            const xpath = xpathPatterns[i];
            const element = findElementByXPath(xpath);
            if (element) {
                console.log(`   ✅ Found element with pattern ${i + 1}/${xpathPatterns.length}!`);
                console.log('   🏆 Successful XPath:', xpath);
                console.log('   📄 Element details:', {
                    tagName: element.tagName,
                    type: element.type || 'no-type',
                    id: element.id || 'no-id',
                    className: element.className || 'no-class',
                    name: element.name || 'no-name'
                });
                
                // Store successful pattern for future optimization
                if (!window.autofillSuccessfulPatterns) {
                    window.autofillSuccessfulPatterns = {};
                }
                window.autofillSuccessfulPatterns[fieldConfig.name] = {
                    xpath: xpath,
                    patternIndex: i + 1,
                    timestamp: Date.now()
                };
                
                return element;
            }
            // Не логируем каждую неудачную попытку чтобы избежать спама в консоли
        }
        
        console.warn(`   🚫 No element found for field: ${fieldConfig.name}`);
        return null;
    }

    /**
     * Generate XPath selector using your specific pattern
     * @param {string} fieldName - Name of the field to find
     * @param {string} fieldType - Type of the field
     */
    function generateXPathSelector(fieldName, fieldType = 'text') {
        // Base selector using your pattern
        const elementType = getElementTypeForField(fieldType);
        
        // Multiple XPath patterns for better compatibility - ordered by effectiveness
        const patterns = [
            // 🥇 MOST EFFECTIVE: Polish form patterns (span with following input)
            `//span[contains(normalize-space(text()),"${fieldName}")]//following::${elementType}[1]`,
            `//div[contains(normalize-space(text()),"${fieldName}")]//following::${elementType}[1]`,
            `//td[contains(normalize-space(text()),"${fieldName}")]//following::${elementType}[1]`,
            
            // 🥈 Standard HTML form patterns
            `//label[contains(normalize-space(text()),"${fieldName}")]//following::${elementType}[1]`,
            `//label[normalize-space(text())="${fieldName}"]/following-sibling::${elementType}`,
            `//label[normalize-space(text())="${fieldName}"]//following::${elementType}[1]`,
            
            // 🥉 Direct attribute matching
            `//${elementType}[@name="${fieldName}"]`,
            `//${elementType}[@id="${fieldName}"]`,
            `//${elementType}[@placeholder="${fieldName}"]`,
            
            // 🔍 Fallback patterns
            `//${elementType}[@name="${fieldName.toLowerCase()}"]`,
            `//${elementType}[@id="${fieldName.toLowerCase()}"]`,
            `//${elementType}[contains(@placeholder,"${fieldName}")]`,
            
            // 🎯 Google Forms specific (if present)
            `//span[normalize-space(text())="${fieldName}"]//ancestor::div[contains(@data-automation-id,"questionItem")]/${elementType}`
        ];
        
        return patterns;
    }

    /**
     * Get the appropriate element type for XPath based on field type
     * @param {string} fieldType - Field type (text, email, textarea, etc.)
     */
    function getElementTypeForField(fieldType) {
        switch (fieldType.toLowerCase()) {
            case 'textarea':
                return 'textarea';
            case 'radio':
                return 'div[@role="radio"]';
            case 'checkbox':
                return 'div[@role="checkbox"]';
            case 'select':
                return 'select | div[@role="listbox"]';
            case 'date':
                return 'input[@type="date"]';
            case 'email':
                return 'input[@type="email"] | input[@type="text"]';
            case 'number':
                return 'input[@type="number"]';
            case 'button':
                return 'button | input[@type="button"] | input[@type="submit"] | div[@role="button"]';
            default:
                return 'input';
        }
    }

    /**
     * Find element by selector (CSS or XPath)
     * @param {string} selector - CSS or XPath selector
     */
    function findElementBySelector(selector, fieldConfig) {
        try {
            // Special handling for radio button selectors with OPTION_VALUE placeholder
            if (fieldConfig && fieldConfig.type === 'radio' && selector.includes('OPTION_VALUE')) {
                console.log('   🔘 Processing radio button selector with option value:', fieldConfig.value);
                const actualSelector = selector.replace('OPTION_VALUE', fieldConfig.value);
                console.log('   🎯 Radio selector after replacement:', actualSelector);
                return findElementByXPath(actualSelector);
            }
            
            // Try CSS selector first
            if (!selector.startsWith('//') && !selector.startsWith('/')) {
                const element = document.querySelector(selector);
                if (element && isVisibleAndEditable(element)) {
                    return element;
                }
            }

            // Try XPath selector
            return findElementByXPath(selector);
        } catch (error) {
            console.warn('Selector failed:', selector, error);
            return null;
        }
    }

    /**
     * Find element by XPath
     * @param {string} xpath - XPath selector
     */
    function findElementByXPath(xpath) {
        try {
            const result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            
            const element = result.singleNodeValue;
            if (element && isVisibleAndEditable(element)) {
                return element;
            }
            
            return null;
        } catch (error) {
            // Тихо обрабатываем ошибки XPath чтобы не засорять консоль
            return null;
        }
    }

    /**
     * Check if element is visible and editable
     * @param {Element} element - DOM element to check
     */
    function isVisibleAndEditable(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return (
            element.type !== 'hidden' &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !element.disabled &&
            !element.readOnly &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    /**
     * Fill field based on its type
     * @param {Element} element - DOM element to fill
     * @param {Object} fieldConfig - Field configuration
     */
    function fillFieldByType(element, fieldConfig) {
        const fieldType = fieldConfig.type.toLowerCase();
        const value = fieldConfig.value;

        console.log(`📝 Field config type: "${fieldConfig.type}"`);
        console.log(`📝 Element details:`, {
            tagName: element.tagName,
            type: element.type,
            role: element.getAttribute('role'),
            placeholder: element.placeholder,
            id: element.id,
            className: element.className
        });
        console.log(`Filling ${fieldType} field with value: "${value}"`);

        try {
            // Auto-detect date fields even if marked as text
            const isDateField = fieldType === 'date' || 
                               (element.getAttribute('role') === 'combobox' && 
                                element.placeholder && 
                                element.placeholder.toLowerCase().includes('date')) ||
                               (element.id && element.id.toLowerCase().includes('datepicker'));
            
            if (isDateField) {
                console.log(`🗓️ Auto-detected date field, using date filling logic`);
                return fillDateInput(element, value);
            }
            
            switch (fieldType) {
                case 'text':
                case 'email':
                case 'phone':
                case 'number':
                case 'textarea':
                    return fillTextInput(element, value);

                case 'date':
                    return fillDateInput(element, value);

                case 'radio':
                    return fillRadioButton(element, value);

                case 'checkbox':
                    return fillCheckbox(element, value);

                case 'select':
                    return fillSelect(element, value);

                case 'button':
                    return clickButton(element, value);

                default:
                    console.warn(`Unknown field type: ${fieldType}, treating as text`);
                    return fillTextInput(element, value);
            }
        } catch (error) {
            console.error(`Error filling ${fieldType} field:`, error);
            return false;
        }
    }

    /**
     * Fill text input fields (input, textarea)
     * @param {Element} element - Input element
     * @param {string} value - Value to fill
     */
    function fillTextInput(element, value) {
        console.log(`✍️ Filling "${element.name || element.id || 'field'}" with: "${value}"`);
        
        try {
            // Focus the element
            element.focus();
            element.click();
            
            // Clear existing value
            element.value = '';
            element.select();
            
            // For modern forms that might have React/Vue
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 
                'value'
            ).set;
            
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 
                'value'
            ).set;
            
            if (element.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(element, value);
            } else if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, value);
            } else {
                element.value = value;
            }
            
            // Trigger events for form frameworks
            const events = [
                new Event('input', { bubbles: true }),
                new Event('change', { bubbles: true }),
                new Event('blur', { bubbles: true }),
                new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
                new KeyboardEvent('keyup', { key: 'Tab', bubbles: true })
            ];
            
            events.forEach(event => {
                element.dispatchEvent(event);
            });
            
            // Additional React-style event
            const reactEvent = new Event('input', { bubbles: true });
            Object.defineProperty(reactEvent, 'target', {
                writable: false,
                value: element
            });
            element.dispatchEvent(reactEvent);
            console.log(`   ✅ Successfully filled text input with: "${value}"`);
            return true;
            
        } catch (error) {
            console.error('Error filling text input:', error);
            return false;
        }
    }

    /**
     * Fill date input fields with double click and text input
     * @param {Element} element - Date input element
     * @param {string} value - Date value to fill (in format DD.MM.YYYY or similar)
     */
    function fillDateInput(element, value) {
        console.log(`📅 Filling date field with value: "${value}"`);
        
        try {
            // Detect date format from placeholder
            const placeholder = element.placeholder || element.getAttribute('placeholder') || '';
            console.log(`   📋 Detected placeholder: "${placeholder}"`);
            
            const formatType = detectDateFormat(placeholder);
            console.log(`   🔍 Detected format type: ${formatType}`);
            
            // Parse and format the date according to detected format
            const formattedDate = formatDateForInput(value, formatType);
            console.log(`   ✏️ Formatted date: "${formattedDate}"`);
            
            const dateToInput = formattedDate || value;
            
            // Step 1: First click to focus
            console.log(`   🖱️ Step 1: First click to focus the field`);
            element.focus();
            element.click();
            
            // Step 2: Wait a bit, then second click
            setTimeout(() => {
                console.log(`   🖱️ Step 2: Second click to activate text input mode`);
                element.click();
                
                // Step 3: Wait a bit more, then input the date
                setTimeout(() => {
                    console.log(`   ⌨️ Step 3: Inputting date "${dateToInput}"`);
                    
                    // Clear any existing value first
                    element.value = '';
                    
                    // Set the date value
                    element.value = dateToInput;
                    
                    // Trigger input events
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Step 4: Press Enter or Tab to confirm
                    setTimeout(() => {
                        console.log(`   ✅ Step 4: Confirming input with Enter key`);
                        
                        const enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(enterEvent);
                        
                        // Also try Tab key as alternative
                        const tabEvent = new KeyboardEvent('keydown', {
                            key: 'Tab',
                            keyCode: 9,
                            which: 9,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(tabEvent);
                        
                        // Final blur to complete the input
                        element.blur();
                        
                        console.log(`   ✅ Successfully filled date field with: "${dateToInput}"`);
                    }, 100);
                    
                }, 150);
                
            }, 100);
            
            return true;
            
        } catch (error) {
            console.error('Error filling date input:', error);
            // Fallback to text input filling
            return fillTextInput(element, value);
        }
    }

    /**
     * Detect date format from placeholder text
     * @param {string} placeholder - Placeholder text
     * @returns {string} - Format type ('mdy', 'dmy', 'ymd', etc.)
     */
    function detectDateFormat(placeholder) {
        const ph = placeholder.toLowerCase();
        
        // Check for common patterns
        if (ph.includes('m/d/y') || ph.includes('mm/dd/y')) {
            return 'mdy'; // Month/Day/Year (US format)
        }
        if (ph.includes('d/m/y') || ph.includes('dd/mm/y')) {
            return 'dmy'; // Day/Month/Year (EU format)
        }
        if (ph.includes('y/m/d') || ph.includes('yyyy/mm/dd')) {
            return 'ymd'; // Year/Month/Day (ISO format)
        }
        if (ph.includes('d.m.y') || ph.includes('dd.mm.y')) {
            return 'dmy_dot'; // Day.Month.Year with dots
        }
        if (ph.includes('d-m-y') || ph.includes('dd-mm-y')) {
            return 'dmy_dash'; // Day-Month-Year with dashes
        }
        
        // Default to US format if no specific pattern detected
        return 'mdy';
    }

    /**
     * Format date string according to detected format
     * @param {string} dateValue - Input date value (e.g., "25.12.2023" or "25/12/2023")
     * @param {string} formatType - Target format type
     * @returns {string} - Formatted date string
     */
    function formatDateForInput(dateValue, formatType) {
        if (!dateValue) return '';
        
        console.log(`   🔄 Converting "${dateValue}" to format: ${formatType}`);
        
        // Parse the input date (handle multiple separators)
        const cleanDate = dateValue.replace(/[^\d]/g, ''); // Remove all non-digits
        
        let day, month, year;
        
        // Try to parse different input formats
        if (dateValue.includes('.') || dateValue.includes('/') || dateValue.includes('-')) {
            const parts = dateValue.split(/[.\/-]/).filter(part => part.length > 0);
            
            if (parts.length === 3) {
                // Detect if input is DD.MM.YYYY or MM/DD/YYYY format
                if (parseInt(parts[0]) > 12) {
                    // First part > 12, must be day (DD.MM.YYYY format)
                    day = parts[0].padStart(2, '0');
                    month = parts[1].padStart(2, '0');
                    year = parts[2];
                    console.log(`   📅 Detected DD.MM.YYYY format: ${day}.${month}.${year}`);
                } else if (parseInt(parts[1]) > 12) {
                    // Second part > 12, must be day, so first is month (MM.DD.YYYY format)
                    month = parts[0].padStart(2, '0');
                    day = parts[1].padStart(2, '0');
                    year = parts[2];
                    console.log(`   📅 Detected MM.DD.YYYY format: ${month}.${day}.${year}`);
                } else {
                    // Ambiguous case (both parts ≤ 12), need to guess based on separator
                    if (dateValue.includes('.')) {
                        // European format with dots: DD.MM.YYYY
                        day = parts[0].padStart(2, '0');
                        month = parts[1].padStart(2, '0');
                        year = parts[2];
                        console.log(`   📅 Ambiguous with dots, assuming DD.MM.YYYY: ${day}.${month}.${year}`);
                    } else {
                        // US format with slashes: MM/DD/YYYY  
                        month = parts[0].padStart(2, '0');
                        day = parts[1].padStart(2, '0');
                        year = parts[2];
                        console.log(`   📅 Ambiguous with slashes, assuming MM/DD/YYYY: ${month}/${day}/${year}`);
                    }
                }
            } else {
                console.warn('   ⚠️ Invalid date format, expected 3 parts');
                return '';
            }
        } else if (cleanDate.length === 8) {
            // DDMMYYYY format
            day = cleanDate.substring(0, 2);
            month = cleanDate.substring(2, 4);
            year = cleanDate.substring(4, 8);
        } else if (cleanDate.length === 6) {
            // DDMMYY format
            day = cleanDate.substring(0, 2);
            month = cleanDate.substring(2, 4);
            year = '20' + cleanDate.substring(4, 6);
        } else {
            console.warn('   ⚠️ Unable to parse date format');
            return '';
        }
        
        // Ensure year is 4 digits
        if (year.length === 2) {
            year = '20' + year;
        }
        
        // Format according to target format
        switch (formatType) {
            case 'mdy':
                return `${month}/${day}/${year}`;
            case 'dmy':
                return `${day}/${month}/${year}`;
            case 'ymd':
                return `${year}/${month}/${day}`;
            case 'dmy_dot':
                return `${day}.${month}.${year}`;
            case 'dmy_dash':
                return `${day}-${month}-${year}`;
            default:
                return `${month}/${day}/${year}`; // Default to US format
        }
    }

    /**
     * Fill radio button based on the provided selector pattern
     * @param {Element} element - Radio button element (can be the container or specific input)
     * @param {string} value - Option text to select
     */
    function fillRadioButton(element, value) {
        console.log(`Attempting to fill radio button with value: "${value}"`);
        
        try {
            // If we have a specific radio input element, try to find the section and then the option
            if (element.tagName === 'INPUT' && element.type === 'radio') {
                // Try to find the radio group container first
                let radioContainer = element.closest('div[role="radiogroup"]') || 
                                  element.closest('fieldset') ||
                                  element.closest('form');
                
                if (radioContainer) {
                    return selectRadioOptionInContainer(radioContainer, value);
                }
            }
            
            // If element is a container, search within it
            return selectRadioOptionInContainer(element, value);
            
        } catch (error) {
            console.error('Error filling radio button:', error);
            return false;
        }
    }

    /**
     * Select radio option within a container using XPath and text matching
     * @param {Element} container - Container element to search within
     * @param {string} optionText - Text of the option to select
     */
    function selectRadioOptionInContainer(container, optionText) {
        console.log(`Looking for radio option "${optionText}" in container:`, container);
        
        // Create multiple search variants for better matching
        const searchVariants = createSearchVariants(optionText);
        console.log(`   🔍 Search variants:`, searchVariants);
        
        // Try multiple strategies to find the radio option
        const strategies = [
            // Strategy 1: Case-insensitive XPath search for label with text containing the option
            () => {
                for (const variant of searchVariants) {
                    // Try case-insensitive XPath using translate function
                    const xpath = `.//label[.//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${variant.toLowerCase()}')]]//input[@type='radio']`;
                    const result = document.evaluate(xpath, container, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    if (result.singleNodeValue) {
                        console.log(`   ✅ Found with XPath variant: "${variant}"`);
                        return result.singleNodeValue;
                    }
                }
                return null;
            },
            
            // Strategy 2: Case-insensitive search in labels with fuzzy matching
            () => {
                const labels = container.querySelectorAll('label');
                for (const label of labels) {
                    const labelText = label.textContent.trim().toLowerCase();
                    
                    for (const variant of searchVariants) {
                        const variantLower = variant.toLowerCase();
                        
                        // Exact match, contains match, or fuzzy match
                        if (labelText === variantLower || 
                            labelText.includes(variantLower) ||
                            isFuzzyMatch(labelText, variantLower)) {
                            
                            const radioInput = label.querySelector('input[type="radio"]') || 
                                             document.getElementById(label.getAttribute('for'));
                            if (radioInput && radioInput.type === 'radio') {
                                console.log(`   ✅ Found with label variant: "${variant}" (matched: "${label.textContent.trim()}")`);
                                return radioInput;
                            }
                        }
                    }
                }
                return null;
            },
            
            // Strategy 3: Case-insensitive search in spans with fuzzy matching
            () => {
                const spans = container.querySelectorAll('span');
                for (const span of spans) {
                    const spanText = span.textContent.trim().toLowerCase();
                    
                    for (const variant of searchVariants) {
                        const variantLower = variant.toLowerCase();
                        
                        if (spanText === variantLower || 
                            spanText.includes(variantLower) ||
                            isFuzzyMatch(spanText, variantLower)) {
                            
                            // Look for radio input in parent hierarchy
                            let parent = span.closest('label') || span.closest('div');
                            if (parent) {
                                const radioInput = parent.querySelector('input[type="radio"]');
                                if (radioInput) {
                                    console.log(`   ✅ Found with span variant: "${variant}" (matched: "${span.textContent.trim()}")`);
                                    return radioInput;
                                }
                            }
                        }
                    }
                }
                return null;
            },
            
            // Strategy 4: Find by value attribute (case-insensitive)
            () => {
                const radioInputs = container.querySelectorAll('input[type="radio"]');
                for (const input of radioInputs) {
                    for (const variant of searchVariants) {
                        if (input.value.toLowerCase() === variant.toLowerCase()) {
                            console.log(`   ✅ Found with value variant: "${variant}" (value: "${input.value}")`);
                            return input;
                        }
                    }
                }
                return null;
            }
        ];
        
        // Try each strategy until we find a radio input
        for (let i = 0; i < strategies.length; i++) {
            try {
                const radioInput = strategies[i]();
                if (radioInput) {
                    console.log(`Found radio input using strategy ${i + 1}:`, radioInput);
                    return clickRadioInput(radioInput);
                }
            } catch (error) {
                console.warn(`Strategy ${i + 1} failed:`, error);
                continue;
            }
        }
        
        console.warn(`Could not find radio option "${optionText}" in container`);
        return false;
    }

    /**
     * Click and select a radio input element
     * @param {Element} radioInput - Radio input element to select
     */
    function clickRadioInput(radioInput) {
        try {
            // Check if element is visible and interactable
            if (!isVisibleAndEditable(radioInput)) {
                console.warn('Radio input is not visible or interactable:', radioInput);
                return false;
            }
            
            // Focus the element first
            radioInput.focus();
            
            // Set checked property
            radioInput.checked = true;
            
            // Trigger events to simulate user interaction
            const events = ['mousedown', 'mouseup', 'click', 'change', 'input'];
            events.forEach(eventType => {
                const event = new Event(eventType, { 
                    bubbles: true, 
                    cancelable: true 
                });
                radioInput.dispatchEvent(event);
            });
            
            // Also try focus and blur events
            radioInput.dispatchEvent(new Event('focus', { bubbles: true }));
            radioInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            console.log('Successfully selected radio option:', radioInput);
            return true;
            
        } catch (error) {
            console.error('Error clicking radio input:', error);
            return false;
        }
    }

    /**
     * Fill checkbox (placeholder for future implementation)
     * @param {Element} element - Checkbox element
     * @param {string} value - Value to set
     */
    function fillCheckbox(element, value) {
        console.log('Checkbox filling - not implemented yet');
        // TODO: Implement checkbox filling
        return false;
    }

    /**
     * Fill select dropdown (placeholder for future implementation)
     * @param {Element} element - Select element
     * @param {string} value - Option to select
     */
    function fillSelect(element, value) {
        console.log('Select filling - not implemented yet');
        // TODO: Implement select filling
        return false;
    }

    /**
     * Click button elements
     * @param {Element} element - Button element
     * @param {string} value - Not used for buttons, but kept for consistency
     */
    function clickButton(element, value) {
        console.log(`🖱️ Clicking button: "${element.textContent?.trim() || element.value || 'Unnamed button'}"`);
        
        try {
            // Focus the element first
            element.focus();
            
            // Simulate a real click
            element.click();
            
            // Also trigger events for frameworks
            const events = [
                new MouseEvent('mousedown', { bubbles: true }),
                new MouseEvent('mouseup', { bubbles: true }),
                new MouseEvent('click', { bubbles: true }),
                new Event('focus', { bubbles: true })
            ];
            
            events.forEach(event => {
                element.dispatchEvent(event);
            });
            
            console.log(`✅ Successfully clicked button`);
            return true;
            
        } catch (error) {
            console.error('Error clicking button:', error);
            return false;
        }
    }

    /**
     * Detect form fields on the page
     */
    function detectFormFields() {
        console.log('\n🔍 Starting form field detection...');
        console.log('🌐 Page URL:', window.location.href);
        console.log('📄 Page title:', document.title);
        
        const fields = [];
        
        // Find all potential form fields
        const inputs = document.querySelectorAll('input, textarea, select');
        console.log(`📋 Found ${inputs.length} total input elements on page`);
        
        let visibleCount = 0;
        inputs.forEach((input, index) => {
            const isVisible = isVisibleAndEditable(input);
            console.log(`\n📝 Input ${index + 1}/${inputs.length}:`, {
                tagName: input.tagName,
                type: input.type || 'no-type',
                id: input.id || 'no-id',
                name: input.name || 'no-name',
                className: input.className || 'no-class',
                visible: isVisible,
                disabled: input.disabled,
                readonly: input.readOnly
            });
            
            if (isVisible) {
                visibleCount++;
                // Try to find associated label
                const label = findFieldLabel(input);
                console.log('   🏷️ Found label:', label || 'No label found');
                
                const fieldData = {
                    name: label || input.name || input.id || `Field ${index + 1}`,
                    type: getFieldTypeFromElement(input),
                    selector: generateSelectorForElement(input),
                    value: '',
                    required: input.required || input.hasAttribute('aria-required')
                };
                
                console.log('   ✅ Adding field:', fieldData);
                fields.push(fieldData);
            } else {
                console.log('   ❌ Skipping (not visible/editable)');
            }
        });
        
        console.log(`\n📊 Detection summary:`);
        console.log(`   📋 Total elements found: ${inputs.length}`);
        console.log(`   👁️ Visible/editable: ${visibleCount}`);
        console.log(`   ✅ Fields detected: ${fields.length}`);
        console.log('   🎯 Field names:', fields.map(f => f.name).join(', '));
        
        return fields;
    }

    /**
     * Find label for a form field
     * @param {Element} element - Form field element
     */
    function findFieldLabel(element) {
        // Try to find by label[for] attribute
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        // Try to find parent label
        const parentLabel = element.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        
        // Try to find nearby text (previous sibling, etc.)
        const previousSibling = element.previousElementSibling;
        if (previousSibling && (previousSibling.tagName === 'LABEL' || previousSibling.tagName === 'SPAN')) {
            return previousSibling.textContent.trim();
        }
        
        return null;
    }

    /**
     * Get field type from DOM element
     * @param {Element} element - DOM element
     */
    function getFieldTypeFromElement(element) {
        if (element.tagName.toLowerCase() === 'textarea') return 'textarea';
        if (element.tagName.toLowerCase() === 'select') return 'select';
        if (element.type) return element.type;
        return 'text';
    }

    /**
     * Generate selector for an element
     * @param {Element} element - DOM element
     */
    function generateSelectorForElement(element) {
        if (element.id) return `#${element.id}`;
        if (element.name) return `[name="${element.name}"]`;
        if (element.className) return `.${element.className.split(' ')[0]}`;
        
        // Generate basic path
        const tagName = element.tagName.toLowerCase();
        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
            const index = siblings.indexOf(element);
            return `${tagName}:nth-of-type(${index + 1})`;
        }
        
        return tagName;
    }

    /**
     * Show notification to user
     * @param {string} message - Message to show
     * @param {string} type - Type of notification (success, warning, error)
     */
    function showFillNotification(message, type = 'success') {
        // Remove any existing notification
        const existing = document.getElementById('autofill-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'autofill-notification';
        
        const bgColor = type === 'success' ? '#4CAF50' : 
                       type === 'warning' ? '#FF9800' : '#f44336';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease-out;
            cursor: pointer;
            max-width: 300px;
        `;
        
        notification.textContent = message;
        
        // Add animation styles if not present
        if (!document.getElementById('autofill-animations')) {
            const style = document.createElement('style');
            style.id = 'autofill-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                @keyframes highlight {
                    0% { box-shadow: 0 0 0 0px rgba(76, 175, 80, 0.7); }
                    50% { box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.3); }
                    100% { box-shadow: 0 0 0 0px rgba(76, 175, 80, 0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 4000);
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }

    /**
     * Highlight an element briefly
     * @param {Element} element - Element to highlight
     */
    function highlightElement(element) {
        if (!element) return;
        
        const originalBoxShadow = element.style.boxShadow;
        const originalTransition = element.style.transition;
        
        element.style.transition = 'box-shadow 0.3s ease';
        element.style.animation = 'highlight 2s ease-out';
        
        setTimeout(() => {
            element.style.animation = '';
            element.style.boxShadow = originalBoxShadow;
            element.style.transition = originalTransition;
        }, 2000);
    }

    /**
     * Show overlay with detected fields (triggered by Ctrl+Shift+D)
     * @param {Array} fields - Array of detected fields
     */
    function showDetectedFieldsOverlay(fields) {
        // Remove existing overlay
        const existing = document.getElementById('autofill-fields-overlay');
        if (existing) {
            existing.remove();
        }

        if (fields.length === 0) {
            showFillNotification('Не найдено полей формы', 'warning');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'autofill-fields-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: white;
            border: 2px solid #667eea;
            border-radius: 12px;
            max-width: 400px;
            max-height: 500px;
            overflow-y: auto;
            z-index: 10001;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            font-family: 'Segoe UI', Arial, sans-serif;
            animation: slideInRight 0.3s ease-out;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            background: #667eea;
            color: white;
            padding: 15px 20px;
            border-radius: 10px 10px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3 style="margin: 0; font-size: 16px;">Найденные поля (${fields.length})</h3>
            <button id="closeFieldsOverlay" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">&times;</button>
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            padding: 15px;
        `;

        const fieldsList = document.createElement('div');
        fields.forEach((field, index) => {
            const fieldItem = document.createElement('div');
            fieldItem.style.cssText = `
                border: 1px solid #e1e5e9;
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 8px;
                background: #fafbfc;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            fieldItem.innerHTML = `
                <div style="font-weight: 500; color: #333; font-size: 13px;">${field.name || 'Unnamed field'}</div>
                <div style="color: #666; font-size: 11px; margin-top: 2px;">
                    Type: ${field.type} | Selector: ${field.selector || 'Auto-detect'}
                </div>
            `;
            
            // Add hover effect
            fieldItem.addEventListener('mouseenter', () => {
                fieldItem.style.borderColor = '#667eea';
                fieldItem.style.background = '#f0f4ff';
            });
            
            fieldItem.addEventListener('mouseleave', () => {
                fieldItem.style.borderColor = '#e1e5e9';
                fieldItem.style.background = '#fafbfc';
            });
            
            // Highlight field on click
            fieldItem.addEventListener('click', () => {
                const xpathPatterns = generateXPathSelector(field.name, field.type);
                let element = null;
                
                // Try each pattern until we find the element
                for (const xpath of xpathPatterns) {
                    element = findElementByXPath(xpath);
                    if (element) break;
                }
                
                if (element) {
                    highlightElement(element);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    showFillNotification(`Подсвечено поле: ${field.name}`);
                } else {
                    showFillNotification(`Не найдено элемента: ${field.name}`, 'warning');
                }
            });
            
            fieldsList.appendChild(fieldItem);
        });

        content.appendChild(fieldsList);
        overlay.appendChild(header);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // Close button functionality
        document.getElementById('closeFieldsOverlay').addEventListener('click', cleanupOverlay);

        // Auto-close after 10 seconds
        setTimeout(() => {
            cleanupOverlay();
        }, 10000);

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                cleanupOverlay();
            }
        };
        
        // Cleanup function
        const cleanupOverlay = () => {
            if (overlay.parentNode) {
                overlay.remove();
            }
            document.removeEventListener('keydown', escapeHandler);
        };
        
        document.addEventListener('keydown', escapeHandler);
        
        // Store cleanup function on overlay for external cleanup
        overlay._cleanup = cleanupOverlay;
    }

    // Enhanced keyboard shortcuts support
    document.addEventListener('keydown', function(e) {
        let shortcut = null;
        
        // Handle Ctrl+Shift+... for system shortcuts (F, M, 1, 2, 3, D, A, H)
        if (e.ctrlKey && e.shiftKey && e.key.length === 1) {
            shortcut = `Ctrl+Shift+${e.key.toUpperCase()}`;
        }
        
        // Handle Alt+... for user profile shortcuts (new simple format)
        if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.length === 1) {
            shortcut = `Alt+${e.key.toUpperCase()}`;
        }
        
        // Handle legacy Ctrl+Alt+... for backward compatibility  
        if (e.ctrlKey && e.altKey && e.key.length === 1) {
            shortcut = `Ctrl+Alt+${e.key.toUpperCase()}`;
        }
        
        if (shortcut) {
            console.log(`⌨️ Keyboard shortcut detected: ${shortcut}`);
            
            // Prevent default behavior for our shortcuts
            e.preventDefault();
            
            // Send all shortcuts to background script for consistent handling
            console.log(`📨 Sending shortcut to background: ${shortcut}`);
            chrome.runtime.sendMessage({
                action: 'keyboardShortcut',
                shortcut: shortcut
            });
        }
    });

    /**
     * Show keyboard shortcuts help overlay
     */
    function showKeyboardShortcutsHelp() {
        const existing = document.getElementById('autofill-help-overlay');
        if (existing) {
            existing.remove();
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'autofill-help-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #667eea;
            border-radius: 12px;
            width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10002;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            font-family: 'Segoe UI', Arial, sans-serif;
            animation: modalSlideIn 0.3s ease-out;
        `;

        overlay.innerHTML = `
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                <h2 style="margin: 0; font-size: 18px;">Skróty klawiszowe AutoFill</h2>
            </div>
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #333; margin-bottom: 10px; font-size: 14px;">🚀 Szybkie wypełnianie:</h3>
                    <div style="color: #666; line-height: 1.6; font-size: 13px;">
                        <div><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+F</code> - Ostatnio używany profil</div>
                        <div><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+M</code> - Najczęściej używany profil</div>
                        <div><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+1/2/3</code> - Top 3 profile według popularności</div>
                        <div style="margin-top: 8px; font-style: italic; color: #888; font-size: 12px;">Skróty Alt+0-9,Q-P dostępne dla profili użytkownika</div>
                    </div>
                </div>
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #333; margin-bottom: 10px; font-size: 14px;">🔧 Narzędzia:</h3>
                    <div style="color: #666; line-height: 1.6; font-size: 13px;">
                        <div><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+A</code> - Otwórz AutoFill</div>
                        <div><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+D</code> - Найти поля формы</div>
                        <div><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+H</code> - Pokaż/ukryj pomoc</div>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button id="closeHelpOverlay" style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;">Zamknij</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close functionality
        document.getElementById('closeHelpOverlay').addEventListener('click', () => {
            overlay.remove();
        });

        // Auto-close after 15 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 15000);
    }

    // Global cleanup function for all overlays
    function cleanupAllOverlays() {
        const overlays = [
            'autofill-fields-overlay',
            'autofill-help-overlay',
            'autofill-notification'
        ];
        
        overlays.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element._cleanup) {
                    element._cleanup();
                } else {
                    element.remove();
                }
            }
        });
    }
    
    /**
     * Click Next button after form filling is completed
     */
    function clickNextButton() {
        console.log('\n🔍 Looking for Next button...');
        
        try {
            // Multiple selectors to find the Next button
            const nextButtonSelectors = [
                'button[aria-label="Next"]',
                'button[data-automation-id="nextButton"]',
                'button[data-automation-id="submitButton"]',
                'button.css-246',
                'button:contains("Next")',
                'input[type="submit"][value*="Next"]',
                'button[type="submit"]:contains("Next")',
                '[role="button"][aria-label="Next"]'
            ];
            
            let nextButton = null;
            
            // Try each selector
            for (const selector of nextButtonSelectors) {
                try {
                    if (selector.includes(':contains')) {
                        // Handle :contains selector manually
                        const buttons = document.querySelectorAll('button');
                        for (const button of buttons) {
                            if (button.textContent.toLowerCase().includes('next')) {
                                nextButton = button;
                                break;
                            }
                        }
                    } else {
                        nextButton = document.querySelector(selector);
                    }
                    
                    if (nextButton) {
                        console.log(`✅ Found Next button using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!nextButton) {
                console.log('⚠️ No Next button found on the page');
                return false;
            }
            
            // Check if button is visible and clickable
            if (!isVisibleAndEditable(nextButton)) {
                console.log('⚠️ Next button found but not visible/clickable');
                return false;
            }
            
            console.log('🖱️ Clicking Next button...');
            console.log('📄 Button details:', {
                tagName: nextButton.tagName,
                textContent: nextButton.textContent,
                ariaLabel: nextButton.getAttribute('aria-label'),
                className: nextButton.className,
                id: nextButton.id
            });
            
            // Focus and click the button
            nextButton.focus();
            nextButton.click();
            
            // Also try mouse events for better compatibility
            nextButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            nextButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            nextButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            
            console.log('✅ Next button clicked successfully!');
            
            // Show notification
            showFillNotification('Formularz wypełniony! Przechodzę do następnej strony...', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error clicking Next button:', error);
            return false;
        }
    }
    
    /**
     * Create search variants for better radio button matching
     * @param {string} text - Original text to create variants for
     * @returns {Array} - Array of text variants
     */
    function createSearchVariants(text) {
        const variants = [text]; // Start with original text
        
        // Add lowercase version
        variants.push(text.toLowerCase());
        
        // Add uppercase version
        variants.push(text.toUpperCase());
        
        // Add title case version (first letter uppercase)
        variants.push(text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());
        
        // Add version with trimmed whitespace
        variants.push(text.trim());
        
        // Add version without special characters
        const cleanText = text.replace(/[^\w\s]/g, '').trim();
        if (cleanText !== text) {
            variants.push(cleanText);
            variants.push(cleanText.toLowerCase());
            variants.push(cleanText.toUpperCase());
        }
        
        // Remove duplicates and empty strings
        return [...new Set(variants)].filter(v => v.length > 0);
    }
    
    /**
     * Check if two strings match fuzzily (with some tolerance for differences)
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {boolean} - Whether texts match fuzzily
     */
    function isFuzzyMatch(text1, text2) {
        if (!text1 || !text2) return false;
        
        // Normalize both strings (lowercase, remove extra spaces and special chars)
        const normalize = (str) => str.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        const norm1 = normalize(text1);
        const norm2 = normalize(text2);
        
        // Exact match after normalization
        if (norm1 === norm2) return true;
        
        // One contains the other
        if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
        
        // Similarity check (Levenshtein distance based)
        const similarity = calculateSimilarity(norm1, norm2);
        console.log(`   🔍 Fuzzy match check: "${text1}" vs "${text2}" = ${similarity}%`);
        
        // Consider it a match if similarity is > 80%
        return similarity > 80;
    }
    
    /**
     * Calculate similarity percentage between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Similarity percentage (0-100)
     */
    function calculateSimilarity(str1, str2) {
        if (str1 === str2) return 100;
        if (str1.length === 0 || str2.length === 0) return 0;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 100;
        
        const distance = levenshteinDistance(longer, shorter);
        return Math.round(((longer.length - distance) / longer.length) * 100);
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Edit distance
     */
    function levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    // Cleanup overlays when page is being unloaded
    window.addEventListener('beforeunload', cleanupAllOverlays);
    
    // Initialize content script
    console.log('\n🚀 Google Forms AutoFill Content Script v2.0 initialized successfully');
    console.log('🌐 Page loaded:', window.location.href);
    console.log('📄 Document title:', document.title);
    console.log('⏰ Timestamp:', new Date().toLocaleTimeString());
    
    // Простое сканирование страницы без детального логирования
    setTimeout(() => {
        const inputs = document.querySelectorAll('input, textarea, select');
        const visibleInputs = Array.from(inputs).filter(i => isVisibleAndEditable(i));
        if (visibleInputs.length > 0) {
            console.log(`📋 AutoFill готов! Найдено ${visibleInputs.length} полей для заполнения`);
        }
    }, 500);

})();
