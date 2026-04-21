/**
 * Checkout Module
 * 
 * Handles automatic price selection on checkout pages based on URL query parameters.
 * When a "price" parameter is present, finds and clicks the corresponding radio input.
 * 
 * Note: This module is called by page-scripts.js when on a checkout page.
 */

/**
 * Initialize checkout page functionality
 * Assumes we're already on a checkout page (routing handled by page-scripts.js)
 */
export function initCheckout() {
    console.log('Checkout Module: Initializing...');

    const urlParams = new URLSearchParams(window.location.search);
    const verbose = urlParams.get('checkout_debug') === '1' || urlParams.get('checkout_debug') === 'true';
    const vlog = (...args) => {
        if (!verbose) return;
        try {
            console.log('[Checkout Debug]', ...args);
        } catch (e) {
            // ignore
        }
    };

    // Optional query-string behavior:
    // - ?hide=<id> hides a checkout price option by id.
    //   We prefer hiding the outer option label (data-testid="checkout-paywall-price-option"),
    //   because Circle renders nested <label for="..."> elements inside each option.
    const hideIdsFromQueryString = (() => {
        try {
            return urlParams
                .getAll('hide')
                .flatMap(v => String(v).split(','))
                .map(v => v.trim())
                .filter(Boolean);
        } catch (e) {
            return [];
        }
    })();

    const applyHideOnce = () => {
        if (hideIdsFromQueryString.length === 0) return false;
        vlog('applyHideOnce:start', { hide: hideIdsFromQueryString });

        const cssEscape = (value) => {
            if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
            return String(value).replace(/["\\]/g, '\\$&');
        };

        let hiddenCount = 0;
        for (const id of hideIdsFromQueryString) {
            const escaped = cssEscape(id);
            vlog('applyHideOnce:id', { id, escaped });

            // Prefer the *outer* option label.
            // Best-effort approach:
            // 1) If the input exists, hide its closest outer option label.
            // 2) Otherwise, find the outer option label by [for="<id>"].
            // 3) Fallback: hide any matching labels.
            const input = document.getElementById(String(id));
            const optionLabelFromInput =
                input && input.closest
                    ? input.closest('label[data-testid="checkout-paywall-price-option"]')
                    : null;

            const optionLabel =
                optionLabelFromInput ||
                document.querySelector(
                    `label[data-testid="checkout-paywall-price-option"][for="${escaped}"]`
                );

            if (optionLabel) {
                vlog('applyHideOnce:removeOuterOption', { id });
                try {
                    optionLabel.remove();
                } catch (e) {
                    // Older browsers: fallback to detach
                    if (optionLabel.parentNode) optionLabel.parentNode.removeChild(optionLabel);
                }
                hiddenCount += 1;
                continue;
            }

            // Fallback: hide any matching label(s).
            const labels = document.querySelectorAll(`label[for="${escaped}"]`);
            vlog('applyHideOnce:fallbackLabelsFound', { id, count: labels.length });
            labels.forEach((label) => {
                if (!label) return;
                try {
                    label.remove();
                } catch (e) {
                    if (label.parentNode) label.parentNode.removeChild(label);
                }
                hiddenCount += 1;
            });
        }

        vlog('applyHideOnce:done', { hiddenCount });
        return hiddenCount > 0;
    };
    
    // Get the price parameter from the URL
    const priceId =
        urlParams.get('price') ||
        urlParams.get('price_id') ||
        urlParams.get('paywall_price_id');
    
    // Validate that the price parameter is numeric
    if (priceId && !/^\d+$/.test(priceId)) {
        console.warn('Checkout Module: Price parameter is not numeric:', priceId);
        // Treat as not provided
    }
    const validPriceId = priceId && /^\d+$/.test(priceId) ? priceId : null;

    if (validPriceId) {
        console.log('Checkout Module: Looking for input with ID:', validPriceId);
    } else {
        console.log('Checkout Module: No valid price parameter found in URL');
    }
    
    // Function to find and click the price input
    const selectPriceInput = () => {
        if (!validPriceId) return true;
        vlog('selectPriceInput:start', { validPriceId });

        // Prefer clicking the outer label option if present (Circle checkout often binds handlers there)
        const optionLabel = document.querySelector(
            `label[data-testid="checkout-paywall-price-option"][for="${validPriceId}"]`
        );
        vlog('selectPriceInput:optionLabel', { found: !!optionLabel });

        const isVisuallySelected = () => {
            const selectedLabel = document.querySelector(
                `label[data-testid="checkout-paywall-price-option"][for="${validPriceId}"][data-selected="true"]`
            );
            return !!selectedLabel;
        };

        const isGroupSelected = () => {
            const checked = document.querySelector('input[name="paywall_price_id"]:checked');
            return !!(checked && checked.id === validPriceId);
        };

        const forceSelectInput = (input) => {
            if (!input) return;
            vlog('selectPriceInput:forceSelectInput', { id: input.id, beforeChecked: !!input.checked });
            try {
                const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
                if (desc && typeof desc.set === 'function') {
                    desc.set.call(input, true);
                } else {
                    input.checked = true;
                }
            } catch (e) {
                // ignore
                input.checked = true;
            }

            // Trigger React/Circle listeners
            try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            vlog('selectPriceInput:forceSelectInput:after', {
                id: input.id,
                afterChecked: !!input.checked,
                visuallySelected: isVisuallySelected(),
                groupSelected: isGroupSelected()
            });
        };

        const dispatchMouseSequence = (el) => {
            if (!el) return;
            vlog('selectPriceInput:dispatchMouseSequence', { tag: el.tagName, for: el.getAttribute && el.getAttribute('for') });
            try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); } catch (e) {}
            try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); } catch (e) {}
            try { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true })); } catch (e) {}
            try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })); } catch (e) {}
            try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e) {}
        };

        if (optionLabel) {
            console.log('Checkout Module: Found option label, clicking to select:', validPriceId);
            try { optionLabel.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
            dispatchMouseSequence(optionLabel);
            vlog('selectPriceInput:optionLabel:click');
            optionLabel.click();

            const inputAfterLabelClick = document.getElementById(validPriceId);
            vlog('selectPriceInput:afterLabelClick', {
                inputFound: !!inputAfterLabelClick,
                inputChecked: !!(inputAfterLabelClick && inputAfterLabelClick.checked),
                visuallySelected: isVisuallySelected(),
                groupSelected: isGroupSelected()
            });
            if (inputAfterLabelClick && (inputAfterLabelClick.checked || isVisuallySelected() || isGroupSelected())) {
                console.log('Checkout Module: Price input successfully selected via label click');
                return true;
            }

            // If the click didn’t update state, force the selection & re-check.
            if (inputAfterLabelClick) {
                forceSelectInput(inputAfterLabelClick);
                if (inputAfterLabelClick.checked || isVisuallySelected() || isGroupSelected()) {
                    console.log('Checkout Module: Price input successfully selected via forced event dispatch');
                    return true;
                }
            }
        }

        const inputElement = document.getElementById(validPriceId);
        vlog('selectPriceInput:directInputLookup', { found: !!inputElement });
        
        if (!inputElement) {
            console.warn('Checkout Module: Input element not found with ID:', validPriceId);
            return false;
        }
        
        // Verify it's a radio input (for safety)
        if (inputElement.type !== 'radio') {
            console.warn('Checkout Module: Element found but it is not a radio input:', inputElement.type);
            return false;
        }
        
        console.log('Checkout Module: Found radio input, clicking to select:', validPriceId);
        vlog('selectPriceInput:inputElement:click', { id: inputElement.id });
        inputElement.click();
        forceSelectInput(inputElement);
        
        // Verify it was checked
        vlog('selectPriceInput:verify', {
            checked: !!inputElement.checked,
            visuallySelected: isVisuallySelected(),
            groupSelected: isGroupSelected()
        });
        if (inputElement.checked || isVisuallySelected() || isGroupSelected()) {
            console.log('Checkout Module: Price input successfully selected');
            return true;
        } else {
            console.warn('Checkout Module: Click executed but input not checked');
            return false;
        }
    };
    
    // Try immediately first (both features)
    const priceDone = selectPriceInput();
    const hideDone = hideIdsFromQueryString.length === 0 ? true : applyHideOnce();
    
    if (priceDone && hideDone) {
        return;
    }

    // If not done immediately, wait for DOM to be ready (React might still be rendering)
    console.log('Checkout Module: Watching for DOM changes...');
    
    // Set up a MutationObserver to watch for the input to appear + apply hides
    const observer = new MutationObserver((mutations, obs) => {
        const priceDoneInner = selectPriceInput();
        const hideDoneInner = hideIdsFromQueryString.length === 0 ? true : applyHideOnce();

        if (priceDoneInner && hideDoneInner) {
            if (validPriceId) {
                console.log('Checkout Module: Successfully selected price input after DOM update');
            }
            obs.disconnect();
        }
    });
    
    // Observe the entire document body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Stop observing after 10 seconds to prevent indefinite watching
    setTimeout(() => {
        observer.disconnect();
        console.log('Checkout Module: Stopped observing after timeout');
    }, 10000);
}

