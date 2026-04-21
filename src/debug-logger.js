/**
 * Debug Logger Utility
 * 
 * Persistent on-screen debugging console that shows logs in real-time.
 * Useful for debugging on mobile devices and native apps where console access is limited.
 * 
 * Enabled only when `debug=1|true` is present in the URL query string.
 */

/**
 * Check whether debug is enabled for this pageview.
 * @returns {boolean} true if `?debug=1|true`
 */
function isDebugEnabled() {
    try {
        const urlParams = new URLSearchParams(window.location.search || '');
        const value = (urlParams.get('debug') || '').toLowerCase();
        return value === '1' || value === 'true';
    } catch (e) {
        return false;
    }
}

class DebugLogger {
    constructor() {
        this.logs = [];
        this.container = null;
        this.logsList = null;
        this.isMinimized = false;
        this.enabled = false;
        this.maxLogs = 300;
        this.pendingDomEntries = [];
        this.flushScheduled = false;
    }

    /**
     * Initialize the debug logger UI
     */
    init() {
        this.enabled = isDebugEnabled();
        if (!this.enabled) return;
        
        if (this.container) {
            return; // Already initialized
        }

        // Create container
        this.container = document.createElement('div');
        this.container.id = 'circle-debug-logger';
        this.container.style.cssText = `
            position: fixed;
            bottom: 0;
            right: 0;
            width: 400px;
            max-width: 90vw;
            max-height: 500px;
            background: rgba(0, 0, 0, 0.95);
            border: 2px solid #4CAF50;
            border-radius: 8px 8px 0 0;
            font-family: monospace;
            font-size: 12px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            background: #4CAF50;
            color: white;
            padding: 8px 12px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        `;
        header.innerHTML = `
            <span>🐛 Circle Debug Logger</span>
            <div>
                <button id="debug-clear" style="background: none; border: none; color: white; cursor: pointer; padding: 4px 8px; font-size: 16px;" title="Clear logs">🗑️</button>
                <button id="debug-minimize" style="background: none; border: none; color: white; cursor: pointer; padding: 4px 8px; font-size: 16px;" title="Minimize">➖</button>
                <button id="debug-close" style="background: none; border: none; color: white; cursor: pointer; padding: 4px 8px; font-size: 16px;" title="Close">✖️</button>
            </div>
        `;

        // Create logs container
        const logsContainer = document.createElement('div');
        logsContainer.id = 'debug-logs-container';
        logsContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
        `;

        // Create logs list
        this.logsList = document.createElement('div');
        logsContainer.appendChild(this.logsList);

        // Assemble
        this.container.appendChild(header);
        this.container.appendChild(logsContainer);
        document.body.appendChild(this.container);

        // Add event listeners
        document.getElementById('debug-clear').addEventListener('click', () => this.clear());
        document.getElementById('debug-minimize').addEventListener('click', () => this.toggleMinimize());
        document.getElementById('debug-close').addEventListener('click', () => this.close());

        // Make draggable (simple implementation)
        this.makeDraggable(header, this.container);

        this.log('Debug Logger initialized', 'success');
    }

    /**
     * Make element draggable
     */
    makeDraggable(handle, element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.bottom = 'auto';
            element.style.right = 'auto';
            element.style.top = (element.offsetTop - pos2) + 'px';
            element.style.left = (element.offsetLeft - pos1) + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    /**
     * Log a message
     * @param {string} message - The message to log
     * @param {string} type - Type of log: 'info', 'success', 'warn', 'error'
     */
    log(message, type = 'info') {
        if (!this.enabled) {
            // Lazily compute enabled (so callers don't need to init explicitly)
            this.enabled = isDebugEnabled();
        }
        if (!this.enabled) return;

        // Ensure UI exists when enabled
        if (!this.container) this.init();

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { message, type, timestamp };
        this.logs.push(logEntry);

        // Cap in-memory logs (prevent runaway memory usage)
        if (this.logs.length > this.maxLogs) {
            this.logs.splice(0, this.logs.length - this.maxLogs);
        }

        // Queue DOM work (batching prevents UI thrash if logs are high-volume)
        this.pendingDomEntries.push({ message, type, timestamp });
        this.scheduleFlush();
    }

    scheduleFlush() {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        const schedule = (cb) => {
            try {
                if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(cb);
            } catch (e) {}
            return setTimeout(cb, 16);
        };
        schedule(() => {
            this.flushScheduled = false;
            this.flushDom();
        });
    }

    flushDom() {
        if (!this.enabled || !this.logsList) {
            this.pendingDomEntries = [];
            return;
        }

        // Drop excess queued entries beyond maxLogs (keep newest)
        if (this.pendingDomEntries.length > this.maxLogs) {
            this.pendingDomEntries = this.pendingDomEntries.slice(-this.maxLogs);
        }

        const fragment = document.createDocumentFragment();
        for (const entry of this.pendingDomEntries) {
            const { message, type, timestamp } = entry;
            const logElement = document.createElement('div');
            logElement.style.cssText = `
                padding: 6px 8px;
                margin-bottom: 4px;
                border-radius: 4px;
                word-wrap: break-word;
                background: ${this.getColorForType(type, true)};
                color: ${this.getColorForType(type, false)};
                border-left: 3px solid ${this.getColorForType(type, false)};
            `;
            logElement.innerHTML = `
                <span style="opacity: 0.7; font-size: 10px;">[${timestamp}]</span>
                <strong style="margin: 0 4px;">${this.getIconForType(type)}</strong>
                <span>${this.escapeHtml(String(message))}</span>
            `;
            fragment.appendChild(logElement);
        }
        this.pendingDomEntries = [];

        this.logsList.appendChild(fragment);

        // Trim DOM nodes to maxLogs
        while (this.logsList.childNodes.length > this.maxLogs) {
            this.logsList.removeChild(this.logsList.firstChild);
        }

        // Auto-scroll to bottom
        const logsContainer = document.getElementById('debug-logs-container');
        if (logsContainer) logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    /**
     * Get color for log type
     */
    getColorForType(type, isBackground) {
        const colors = {
            info: { bg: 'rgba(33, 150, 243, 0.1)', fg: '#2196F3' },
            success: { bg: 'rgba(76, 175, 80, 0.1)', fg: '#4CAF50' },
            warn: { bg: 'rgba(255, 152, 0, 0.1)', fg: '#FF9800' },
            error: { bg: 'rgba(244, 67, 54, 0.1)', fg: '#F44336' }
        };
        return isBackground ? colors[type].bg : colors[type].fg;
    }

    /**
     * Get icon for log type
     */
    getIconForType(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warn: '⚠️',
            error: '❌'
        };
        return icons[type] || 'ℹ️';
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
        if (this.logsList) {
            this.logsList.innerHTML = '';
        }
        this.log('Logs cleared', 'info');
    }

    /**
     * Toggle minimize
     */
    toggleMinimize() {
        const logsContainer = document.getElementById('debug-logs-container');
        if (logsContainer) {
            this.isMinimized = !this.isMinimized;
            logsContainer.style.display = this.isMinimized ? 'none' : 'block';
            document.getElementById('debug-minimize').textContent = this.isMinimized ? '➕' : '➖';
        }
    }

    /**
     * Close the logger
     */
    close() {
        if (this.container) {
            this.container.remove();
            this.container = null;
            this.logsList = null;
        }
    }
}

// Create singleton instance
const debugLogger = new DebugLogger();

// Export convenience functions
export function debugLog(message, type = 'info') {
    debugLogger.log(message, type);
}

export function debugSuccess(message) {
    debugLogger.log(message, 'success');
}

export function debugWarn(message) {
    debugLogger.log(message, 'warn');
}

export function debugError(message) {
    debugLogger.log(message, 'error');
}

export function initDebugLogger() {
    debugLogger.init();
}

export function isDebugLoggerEnabled() {
    return isDebugEnabled();
}

export function clearDebugLogs() {
    debugLogger.clear();
}

