/**
 * Circle Dynamic Events Module (dynamicEvents)
 *
 * Updates event blocks from inline data (no fetch). Uses MutationObserver for React/Circle.so.
 *
 * - Featured block: container 1d0e787c… (title, content, date)
 * - Upcoming events: list 8b3102a0… (excludes latest; future dates only)
 * - Past events: list 1b42b004… (past dates only)
 *
 * Data: edit INLINE_EVENTS below, or set window.circleEventsConfig = { inlineEvents: { events: [...] } }
 */

const CONTAINER_ID = '1d0e787c-b3a6-4a10-8f56-67961e6cfaf3';
const TITLE_ID = 'fe8ae860-2f7d-4cca-b55b-c6d6796fff1d';
const CONTENT_ID = 'bc9244a1-aa87-4993-a874-67acd0c9b9be';
const DATE_ID = 'eafed2f4-d61d-471a-9a2c-c3e1a638a586';
const UPCOMING_LIST_ID = '8b3102a0-0f06-4cda-a21b-f58b59411bf1';
const PAST_LIST_ID = '1b42b004-540a-432c-8e36-c394c7a2034a';

/** Replace or extend this with output from fetch_space_events.py (events array: title, description, start_at, end_at, published_at, created_at) */
const INLINE_EVENTS = {
    events: [
        // Example: { id: 1, title: 'Event title', description: '...', start_at: null, end_at: null, published_at: '2026-02-23T15:50:17.782Z', created_at: '2026-02-23T15:50:17.782Z' }
    ]
};

function getEvents() {
    const c = window.circleEventsConfig || {};
    if (c.inlineEvents && Array.isArray(c.inlineEvents.events)) return c.inlineEvents.events;
    return INLINE_EVENTS.events || [];
}

function formatTime(d) {
    const hours = d.getHours();
    const mins = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return h + ':' + (mins < 10 ? '0' : '') + mins + ' ' + ampm;
}

function formatEventDate(event) {
    const startRaw = event.start_at || event.published_at || event.created_at;
    const endRaw = event.end_at;
    if (!startRaw) return '';
    const start = new Date(startRaw);
    if (isNaN(start.getTime())) return startRaw;
    const months = 'JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER'.split(' ');
    const dateStr = start.getDate() + ' ' + months[start.getMonth()];
    const end = endRaw ? new Date(endRaw) : null;
    if (end && !isNaN(end.getTime())) {
        return dateStr + '\n' + formatTime(start) + ' - ' + formatTime(end);
    }
    return dateStr + '\n' + formatTime(start);
}

function formatDateForList(event) {
    const startRaw = event.start_at || event.published_at || event.created_at;
    const endRaw = event.end_at;
    if (!startRaw) return '';
    const start = new Date(startRaw);
    if (isNaN(start.getTime())) return '';
    const days = 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' ');
    const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
    let part = days[start.getDay()] + ', ' + months[start.getMonth()] + ' ' + start.getDate() + ', ' + formatTime(start);
    if (endRaw) {
        const end = new Date(endRaw);
        if (!isNaN(end.getTime())) part += '\u2009–\u2009' + formatTime(end);
    }
    return part + ' GMT';
}

function eventDate(event) {
    const raw = event.start_at || event.published_at || event.created_at;
    return raw ? new Date(raw) : null;
}

function setText(el, text) {
    if (!el) return;
    const target = el.querySelector('p') || el.querySelector('div') || el;
    if (target) target.textContent = text;
}

function applyEvent(container, event) {
    setText(container.querySelector('#' + TITLE_ID), event.title || '');
    setText(container.querySelector('#' + CONTENT_ID), event.description || '');
    setText(container.querySelector('#' + DATE_ID), formatEventDate(event));
}

const upcomingBlockTpl = (
    '<div class="wb-container wb-mx-auto wb-p-8 wb-h-auto wb-min-h-16" data-block="true" data-block-type="container" style="padding: 0px;">' +
    '<h4 class="wb-text-h4-color wb-text-h4 wb-font-h4 wb-leading-h4 wb-tracking-h4 wb-whitespace-pre-wrap" data-testid="builder-heading" data-block="true" data-block-type="h4" style="color: rgb(107, 25, 91); margin: 0px 0px 10px;"><div><p>{{title}}</p></div></h4>' +
    '<p class="wb-whitespace-pre-wrap wb-text-p1-color wb-font-p1 wb-text-p1 wb-leading-p1 wb-tracking-p1" data-testid="builder-paragraph" data-block="true" data-block-type="p" style="margin: 0px 0px 5px;"><div><p>{{date}}</p></div></p>' +
    '<p class="wb-whitespace-pre-wrap wb-text-p1-color wb-font-p1 wb-text-p1 wb-leading-p1 wb-tracking-p1" data-testid="builder-paragraph" data-block="true" data-block-type="p" style="margin: 0px 0px 30px;"><div><p>Live stream</p></div></p>' +
    '</div>'
);
const pastBlockTpl = (
    '<div class="wb-container wb-mx-auto wb-p-8 wb-h-auto wb-min-h-16" data-block="true" data-block-type="container" style="padding: 0px 0px 32px;">' +
    '<h4 class="wb-text-h4-color wb-text-h4 wb-font-h4 wb-leading-h4 wb-tracking-h4 wb-whitespace-pre-wrap" data-testid="builder-heading" data-block="true" data-block-type="h4" style="color: rgb(107, 25, 91); margin: 0px 0px 10px;"><div><p>{{title}}</p></div></h4>' +
    '<p class="wb-whitespace-pre-wrap wb-text-p1-color wb-font-p1 wb-text-p1 wb-leading-p1 wb-tracking-p1" data-testid="builder-paragraph" data-block="true" data-block-type="p" style="margin: 0px 0px 5px;"><div><p>{{date}}</p></div></p>' +
    '<p class="wb-whitespace-pre-wrap wb-text-p1-color wb-font-p1 wb-text-p1 wb-leading-p1 wb-tracking-p1" data-testid="builder-paragraph" data-block="true" data-block-type="p" style="margin: 0px 0px 30px;"><div><p>Live stream</p></div></p>' +
    '<div data-block="true" data-block-type="horizontalLine"><div class="wb-relative wb-flex wb-items-center wb-justify-center"><div class="wb-relative wb-flex wb-w-full" data-testid="builder-horizontal-line" style="border-color: rgb(107, 25, 91); border-top-width: 1px; border-style: solid; padding: 1px 0px 0px; margin: 0px; width: 100%; height: 1px; min-width: auto; min-height: auto;"></div></div></div>' +
    '</div>'
);

function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function renderUpcoming(events) {
    const now = Date.now();
    const upcoming = [];
    for (let i = 1; i < events.length; i++) {
        const d = eventDate(events[i]);
        if (d && d.getTime() >= now) upcoming.push(events[i]);
    }
    const el = document.getElementById(UPCOMING_LIST_ID);
    if (!el) return;
    el.innerHTML = upcoming.map(e => {
        return upcomingBlockTpl.replace('{{title}}', escapeHtml(e.title || '')).replace('{{date}}', escapeHtml(formatDateForList(e)));
    }).join('');
}

function renderPast(events) {
    const now = Date.now();
    const past = [];
    for (let i = 0; i < events.length; i++) {
        const d = eventDate(events[i]);
        if (d && d.getTime() < now) past.push(events[i]);
    }
    const el = document.getElementById(PAST_LIST_ID);
    if (!el) return;
    el.innerHTML = past.map(e => {
        return pastBlockTpl.replace('{{title}}', escapeHtml(e.title || '')).replace('{{date}}', escapeHtml(formatDateForList(e)));
    }).join('');
}

function run() {
    const container = document.getElementById(CONTAINER_ID);
    const hasUpcoming = document.getElementById(UPCOMING_LIST_ID);
    const hasPast = document.getElementById(PAST_LIST_ID);
    if (!container && !hasUpcoming && !hasPast) return;
    const events = getEvents();
    if (events.length && container) applyEvent(container, events[0]);
    if (events.length && hasUpcoming) renderUpcoming(events);
    if (events.length && hasPast) renderPast(events);
}

/**
 * Initialize the Women in Ag events module: use inline events and populate featured/upcoming/past blocks.
 * Sets up MutationObserver so it re-runs when containers appear (e.g. Circle React mount).
 */
export function initDynamicEvents() {
    const container = document.getElementById(CONTAINER_ID);
    const hasUpcoming = document.getElementById(UPCOMING_LIST_ID);
    const hasPast = document.getElementById(PAST_LIST_ID);
    if (!container && !hasUpcoming && !hasPast) {
        const observer = new MutationObserver(() => {
            if (document.getElementById(CONTAINER_ID) || document.getElementById(UPCOMING_LIST_ID) || document.getElementById(PAST_LIST_ID)) {
                run();
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        return;
    }
    run();
    const observer = new MutationObserver(() => {
        if (document.getElementById(CONTAINER_ID) || document.getElementById(UPCOMING_LIST_ID) || document.getElementById(PAST_LIST_ID)) {
            run();
        }
    });
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
}