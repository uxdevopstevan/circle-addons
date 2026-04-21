/**
 * Circle Web Component Module
 * 
 * Provides a custom <circle-widget> web component that can be placed
 * anywhere on the Circle.so site with configurable attributes.
 */

/**
 * Custom Web Component: <circle-widget>
 * 
 * Attributes:
 * - page: Exact page path to match (e.g., "/posts")
 * - page-pattern: Regex pattern for flexible matching (e.g., "^/discussion")
 * - group: Identifier for the widget instance
 */
class CircleWidget extends HTMLElement {
    constructor() {
        super();
        // Attach Shadow DOM for better encapsulation and native app compatibility
        this.attachShadow({ mode: 'open' });
    }
    
    connectedCallback() {
        console.log('CircleWidget: Component detected and mounted');
        
        // Check preconditions
        if (!this.checkPreconditions()) {
            console.log('CircleWidget: Preconditions not met, skipping execution');
            return;
        }
        
        console.log('CircleWidget: Preconditions met, executing logic');
        this.executeLogic();
    }
    
    checkPreconditions() {
        const currentPath = window.location.pathname;
        
        // Check for exact page match
        const pageAttr = this.getAttribute('page');
        if (pageAttr) {
            if (currentPath === pageAttr) {
                console.log(`CircleWidget: Page match found - ${pageAttr}`);
                return true;
            } else {
                console.log(`CircleWidget: Page mismatch - expected ${pageAttr}, got ${currentPath}`);
                return false;
            }
        }
        
        // Check for regex pattern match
        const pagePattern = this.getAttribute('page-pattern');
        if (pagePattern) {
            try {
                const regex = new RegExp(pagePattern);
                if (regex.test(currentPath)) {
                    console.log(`CircleWidget: Page pattern match found - ${pagePattern}`);
                    return true;
                } else {
                    console.log(`CircleWidget: Page pattern mismatch - pattern ${pagePattern}, path ${currentPath}`);
                    return false;
                }
            } catch (e) {
                console.error('CircleWidget: Invalid regex pattern', e);
                return false;
            }
        }
        
        // If no conditions specified, allow execution
        console.log('CircleWidget: No preconditions specified, allowing execution');
        return true;
    }
    
    executeLogic() {
        const group = this.getAttribute('group');
        const allAttributes = {};
        
        // Collect all attributes for logging
        for (let attr of this.attributes) {
            allAttributes[attr.name] = attr.value;
        }
        
        console.log('CircleWidget: EXECUTING with configuration:', allAttributes);
        console.log(`CircleWidget: Group = ${group || 'none'}`);
        
        // Create template with Shadow DOM for native app compatibility
        const template = document.createElement('template');
        template.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                .circle-widget-container {
                    padding: 15px;
                    margin: 10px 0;
                    background: #e3f2fd;
                    border-left: 4px solid #2196F3;
                    border-radius: 4px;
                    font-family: Arial, sans-serif;
                }
                .circle-widget-container strong {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 16px;
                }
                .circle-widget-container small {
                    display: block;
                    color: #666;
                    margin-top: 4px;
                    font-size: 13px;
                }
                .circle-widget-container code {
                    background: #fff;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                    font-size: 12px;
                }
            </style>
            <div class="circle-widget-container">
                <strong>✅ Circle Widget Active</strong>
                <small>Group: <code>${group || 'none'}</code></small>
                <small>Page: <code>${window.location.pathname}</code></small>
                <slot></slot>
            </div>
        `;
        
        // Clear shadow root and append template
        this.shadowRoot.innerHTML = '';
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        
        console.log('CircleWidget: Visual output rendered in Shadow DOM');
    }
}

/**
 * Initialize web component system
 */
export function initWebComponent() {
    console.log('WebComponent Module: Initializing...');
    
    // Register the custom element if not already registered
    if (!customElements.get('circle-widget')) {
        customElements.define('circle-widget', CircleWidget);
        console.log('WebComponent Module: Custom element <circle-widget> registered');
    }
    
    // Process any existing web components on the page
    const existingComponents = document.querySelectorAll('circle-widget');
    if (existingComponents.length > 0) {
        console.log(`WebComponent Module: Found ${existingComponents.length} existing component(s)`);
    }
    
    // Set up MutationObserver to detect dynamically added components
    // This is essential for React-based sites like Circle.so
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                // Check if the added node is our web component
                if (node.nodeName === 'CIRCLE-WIDGET') {
                    console.log('WebComponent Module: Detected new circle-widget component added to DOM');
                }
                // Also check child nodes in case component is nested
                if (node.querySelectorAll) {
                    const nestedComponents = node.querySelectorAll('circle-widget');
                    if (nestedComponents.length > 0) {
                        console.log(`WebComponent Module: Detected ${nestedComponents.length} nested component(s) added to DOM`);
                    }
                }
            });
        });
    });
    
    // Observe the entire document for added nodes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('WebComponent Module: MutationObserver active and watching for components');
}

