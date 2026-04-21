/**
 * Debug Logger Utility
 * 
 * Persistent on-screen debugging console that shows logs in real-time.
 * Useful for debugging on mobile devices and native apps where console access is limited.
 * 
 * Only visible to authorized users (admins or specific publicUids)
 */

/**
 * Check if current user is authorized to see debug logger
 * Only admins can see the debug logger
 * @returns {boolean}
 */
function isUserAuthorized() {
    // Check if circleUser object exists
    if (!window.circleUser) {
        console.log('Debug Logger: No circleUser object found');
        return false;
    }
    
    const user = window.circleUser;
    
    // Only allow admins
    if (user.isAdmin === 'true' || user.isAdmin === true) {
        console.log('Debug Logger: User is admin, authorized');
        return true;
    }
    
    console.log('Debug Logger: User is not an admin, debug logger hidden');
    return false;
}

class DebugLogger {
    constructor() {
        this.logs = [];
        this.container = null;
        this.logsList = null;
        this.isMinimized = false;
        this.isAuthorized = false;
    }

    /**
     * Initialize the debug logger UI
     */
    init() {
        // Check authorization first
        if (!isUserAuthorized()) {
            this.isAuthorized = false;
            console.log('Debug Logger: Not authorized, UI will not be shown');
            return;
        }
        
        this.isAuthorized = true;
        
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
        // Always log to console
        console.log(`[Circle Debug] ${message}`);
        
        // Check if we should show UI
        if (!this.container) {
            this.init();
        }
        
        // If user not authorized, only log to console
        if (!this.isAuthorized) {
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { message, type, timestamp };
        this.logs.push(logEntry);

        // Create log element
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
            <span>${this.escapeHtml(message)}</span>
        `;

        this.logsList.appendChild(logElement);

        // Auto-scroll to bottom
        const logsContainer = document.getElementById('debug-logs-container');
        if (logsContainer) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
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

export function clearDebugLogs() {
    debugLogger.clear();
}

