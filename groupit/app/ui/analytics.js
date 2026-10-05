// Web analytics for the browser pages: Google Analytics (GA4), consent-first, dark by default.
//
// Added 2026-10-05 (round 35). Read the header of analyticsConfig.ts first: with no measurement id
// NOTHING in this file does anything, and that is the shipped state.
//
// WHAT THE RULES ARE, in the order they bite
//
//   1. No id, no effect. `createAnalytics` returns an inert object before it reads a single member of
//      its environment, so there is no storage read, no DOM change, no network request, no cookie.
//   2. No Google code until the visitor says yes. The page does not carry a gtag <script> tag; this
//      module appends one only after an explicit Accept (or a still-valid earlier Accept). Until then
//      Google's servers are not contacted at all, which is stronger than Consent Mode's "denied" state
//      (Google's tag still sends cookieless pings in that state; ours is not even on the page).
//   3. A browser that says no, means no. Global Privacy Control, or Do Not Track, is treated as a
//      Decline: no banner, no script, nothing stored.
//   4. What may be sent is a closed list. Event names, parameter names and every parameter VALUE are
//      checked against `SPEC` below; anything not on it is dropped, not forwarded. There is no free
//      text anywhere in it, and the board, the link and the fragment are not on it.
//   5. The address Google sees is rebuilt, never copied. `page_location` is the site's own canonical
//      address for the page (plus three campaign tags, never on the shared-board page); the query
//      string and the fragment are never read. `page_referrer` is cut to its origin.
//   6. Events that happen before the visitor has chosen are held in memory only (never written to
//      storage) and are sent on Accept or dropped on Decline or on leaving the page.
//
// WHY ONE FILE FOR THE LOGIC AND INJECTED ENVIRONMENT. Everything that touches the world (storage,
// cookies, the script tag, the banner, the page's address) goes through `Env`, so test/analytics.ts can
// run every rule above in Node against a recorder, with no browser and no network. `browserEnv` is
// the only place that reaches for a global.
import { MEASUREMENT_ID } from './analyticsConfig.js';
// ── the closed vocabulary ──────────────────────────────────────────────────────────────────────────
// Every value an event may carry. Reused keys (`rows`, `cols`, `diff`, `res`, `from`, `kind`, `why`) mean the
// same thing here as in the app's catalogue (docs/analytics-events.md), so a GA4 property that holds
// both does not spend a second custom dimension on them. New keys: page_kind, rule, tb, perfect, cta,
// dest. (The app already uses `store` for something else, hence `dest`.)
export const PAGE_KINDS = ['landing', 'board', 'play'];
/** Where the visitor came from, by kind. A shared board opened from a chat app arrives as `direct`: chat apps send no referrer. */
export const REFERRER_CATEGORIES = ['direct', 'same_site', 'search', 'social', 'app', 'other'];
/** The app's own names for a rule (src/ui/names.ts, checked against it by test/analytics.ts), or `none`. */
export const RULE_NAMES = [
    'Tally', 'Colourless', 'Connected', 'Gold', 'Turns', 'Neighbours', 'Rectangles', 'Double', 'Holes',
    'Lamps', 'Sight', 'Knight', 'Crossroads', 'Biggest', 'Pairs', 'Perimeter', 'none',
];
/**
 * A rule's name as an event value: `none` for a board with no rule to name (modeName returned null), the
 * name itself when it is on the list, and nothing at all when it is a name this list has not heard of, so
 * a rule added to names.ts and not here is a gap in the report, not a wrong number in it.
 */
export function ruleValue(name) {
    if (name === null)
        return 'none';
    return RULE_NAMES.includes(name) ? name : undefined;
}
/** Why a shared link did not open (src/ui/errors.ts, decodeWhy). Closed: never the engine's sentence. */
export const DECODE_WHY = ['no_board', 'not_a_link', 'length', 'characters', 'damaged', 'newer', 'browser', 'other'];
/** Why the browser game did not start: the loader file would not load, or the engine refused to start. */
export const PLAY_WHY = ['loader', 'engine'];
export const SOLVE_BUCKETS = ['lt30s', '30s_2m', '2m_5m', '5m_15m', 'gt15m'];
export const LOAD_BUCKETS = ['lt5s', '5s_15s', '15s_45s', 'gt45s'];
/** The buttons worth counting. Each is a `data-cta` attribute in a page's HTML. */
export const CTAS = ['play_full', 'play_more', 'what_is', 'share_board'];
/** The store buttons. None exists on a page yet; the first one added only needs `data-store="google_play"`. */
export const DESTS = ['google_play', 'app_store'];
const SIZE = { int: [1, 40] };
/** A board's difficulty as the link carries it: 0 to 4 on every shipped board, bounded at 9 so a future grade still fits. */
const DIFF = { int: [0, 9] };
/**
 * Every event, and for each the only parameters it may carry. This table IS the privacy contract:
 * the sanitiser reads only these keys out of whatever it is handed, and only values on these lists.
 * `page_view` is GA4's own event name (so its built-in reports work); the rest are prefixed `web_` so
 * they never mix with the app's events in a shared property.
 */
export const SPEC = {
    page_view: { page_kind: PAGE_KINDS, from: REFERRER_CATEGORIES },
    web_board_open: { res: ['ok', 'bad_link'], rows: SIZE, cols: SIZE, diff: DIFF, rule: RULE_NAMES, why: DECODE_WHY },
    web_board_solved: { kind: ['shared', 'sample'], rows: SIZE, cols: SIZE, diff: DIFF, rule: RULE_NAMES, tb: SOLVE_BUCKETS, perfect: [0, 1] },
    web_cta: { cta: CTAS, page_kind: PAGE_KINDS },
    web_store_click: { dest: DESTS, page_kind: PAGE_KINDS },
    web_play_ready: { tb: LOAD_BUCKETS },
    web_play_failed: { why: PLAY_WHY },
};
/**
 * The one parameter without which an event means nothing: a click with no button named, a failure with no
 * reason. An event missing its required key (or carrying a word that is not on its list) is dropped
 * whole, rather than counted as a blank.
 */
const REQUIRED = {
    web_board_open: 'res', web_board_solved: 'kind', web_cta: 'cta', web_store_click: 'dest', web_play_failed: 'why',
};
export const EVENT_NAMES = Object.keys(SPEC);
function accepts(vocab, value) {
    if (typeof value !== 'string' && typeof value !== 'number')
        return false;
    if ('int' in vocab)
        return Number.isInteger(value) && value >= vocab.int[0] && value <= vocab.int[1];
    return vocab.includes(value);
}
/**
 * The parameters an event may carry, or null for an event that is not on the list. Reads ONLY the
 * keys the spec names, so nothing else the caller passed can get through, and a value that is not on
 * its list is dropped on its own (the event still counts).
 */
export function sanitise(name, params) {
    if (!Object.prototype.hasOwnProperty.call(SPEC, name))
        return null;
    const spec = SPEC[name];
    const out = {};
    if (typeof params === 'object' && params !== null) {
        const given = params;
        for (const key of Object.keys(spec)) {
            const value = given[key];
            if (accepts(spec[key], value))
                out[key] = value;
        }
    }
    const required = REQUIRED[name];
    if (required !== undefined && !(required in out))
        return null;
    return out;
}
// ── the numbers that become words ──────────────────────────────────────────────────────────────────
/** Time from a board being shown to it being solved. Wall clock: a backgrounded tab counts. */
export function solveBucket(ms) {
    if (!Number.isFinite(ms) || ms < 0)
        return undefined;
    const s = ms / 1000;
    return s < 30 ? 'lt30s' : s < 120 ? '30s_2m' : s < 300 ? '2m_5m' : s < 900 ? '5m_15m' : 'gt15m';
}
/** Time from the browser game's page opening to the engine being up. */
export function loadBucket(ms) {
    if (!Number.isFinite(ms) || ms < 0)
        return undefined;
    const s = ms / 1000;
    return s < 5 ? 'lt5s' : s < 15 ? '5s_15s' : s < 45 ? '15s_45s' : 'gt45s';
}
// ── the address Google is allowed to see ───────────────────────────────────────────────────────────
/** The only query parameters ever forwarded, and only with a plain value. The board page forwards none. */
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
const CAMPAIGN_VALUE = /^[A-Za-z0-9._-]{1,40}$/;
/** What each page is called to Google. A fixed word, never `document.title`. */
const PAGE_TITLES = {
    landing: 'GroupIt',
    board: 'GroupIt shared board',
    play: 'GroupIt in the browser',
};
/** Where each page lives under the site's base path. The pathname is never read: it is rebuilt from this. */
const PAGE_PATHS = { landing: '', board: 'b/', play: 'play/' };
/**
 * The page's address as Google will see it: the site's own canonical address for the page. The
 * fragment is not a member of `Where`, so it cannot be read. The query string is read only for the
 * three campaign tags (never on the board page, whose `?b=` form carries the board).
 */
export function safeLocation(where, basePath, page) {
    let query = '';
    if (page !== 'board') {
        const params = new URLSearchParams(where.search);
        const keep = [];
        for (const key of CAMPAIGN_KEYS) {
            const value = params.get(key);
            if (value !== null && CAMPAIGN_VALUE.test(value))
                keep.push(`${key}=${value}`);
        }
        if (keep.length > 0)
            query = '?' + keep.join('&');
    }
    return where.origin + basePath + PAGE_PATHS[page] + query;
}
/**
 * The referrer, cut down. A cross-origin referrer becomes its origin; a same-site one keeps its path
 * (the pages' paths are fixed words) and loses its query, because a same-site referrer can be a
 * `b/?b=<board>` page. Anything that is not http(s) is dropped. '' means none.
 */
export function safeReferrer(referrer, siteOrigin) {
    let url;
    try {
        url = new URL(referrer);
    }
    catch {
        return '';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
        return '';
    return url.origin === siteOrigin ? url.origin + url.pathname : url.origin + '/';
}
/** Referrer hosts, by kind. Deliberately short and boring: anything not on a list is `other`. */
const SEARCH = [/^(?:[a-z0-9-]+\.)*google\.[a-z.]{2,6}$/, /(?:^|\.)bing\.com$/, /(?:^|\.)duckduckgo\.com$/,
    /(?:^|\.)yahoo\.com$/, /(?:^|\.)ecosia\.org$/, /(?:^|\.)search\.brave\.com$/,
    /(?:^|\.)startpage\.com$/, /(?:^|\.)qwant\.com$/, /(?:^|\.)baidu\.com$/, /(?:^|\.)yandex\.[a-z]{2,3}$/];
const SOCIAL = [/(?:^|\.)facebook\.com$/, /(?:^|\.)instagram\.com$/, /^t\.co$/, /(?:^|\.)twitter\.com$/, /(?:^|\.)x\.com$/,
    /(?:^|\.)reddit\.com$/, /(?:^|\.)linkedin\.com$/, /(?:^|\.)pinterest\.[a-z.]{2,6}$/, /(?:^|\.)tiktok\.com$/,
    /(?:^|\.)youtube\.com$/, /(?:^|\.)threads\.net$/, /(?:^|\.)bsky\.app$/, /(?:^|\.)tumblr\.com$/];
/** The referrer by kind. `direct` includes everything that sends no referrer, which is every chat app. */
export function referrerCategory(referrer, siteOrigin) {
    if (referrer === '')
        return 'direct';
    let url;
    try {
        url = new URL(referrer);
    }
    catch {
        return 'other';
    }
    if (url.protocol === 'android-app:' || url.protocol === 'ios-app:')
        return 'app';
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
        return 'other';
    if (url.origin === siteOrigin)
        return 'same_site';
    const host = url.hostname.toLowerCase();
    if (SEARCH.some(r => r.test(host)))
        return 'search';
    if (SOCIAL.some(r => r.test(host)))
        return 'social';
    return 'other';
}
/**
 * The event a click means, or null. Reads `data-cta` and `data-store` off the nearest marked element
 * and keeps the value only if it is on the closed list: markup is the one place a free word could
 * enter, so it is checked like everything else.
 */
export function readClick(target, page) {
    if (target === null || typeof target.closest !== 'function')
        return null;
    const store = target.closest('[data-store]')?.getAttribute('data-store') ?? null;
    if (store !== null && DESTS.includes(store))
        return { name: 'web_store_click', params: { dest: store, page_kind: page } };
    const cta = target.closest('[data-cta]')?.getAttribute('data-cta') ?? null;
    if (cta !== null && CTAS.includes(cta))
        return { name: 'web_cta', params: { cta: cta, page_kind: page } };
    return null;
}
// ── the consent record ─────────────────────────────────────────────────────────────────────────────
/** localStorage key. The origin is shared with every other site the studio hosts, so it is namespaced. */
export const CONSENT_KEY = 'groupit.analytics.consent';
/** Bump when the banner's wording or what is collected changes: everyone is asked again. */
export const CONSENT_VERSION = 1;
/** An answer is asked for again after a year, inside the 13 months regulators generally accept. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
function readChoice(store, now) {
    let raw;
    try {
        raw = store.get(CONSENT_KEY);
    }
    catch {
        return null;
    }
    if (raw === null)
        return null;
    try {
        const rec = JSON.parse(raw);
        if (rec.v !== CONSENT_VERSION)
            return null;
        if (rec.c !== 'granted' && rec.c !== 'denied')
            return null;
        if (typeof rec.t !== 'number' || !Number.isFinite(rec.t))
            return null;
        if (rec.t > now + 24 * 60 * 60 * 1000 || now - rec.t > CONSENT_MAX_AGE_MS)
            return null;
        return rec.c;
    }
    catch {
        return null;
    }
}
function writeChoice(store, choice, now) {
    try {
        store.set(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, c: choice, t: now }));
    }
    catch { /* kept in memory for this page only */ }
}
const INERT = Object.freeze({ state: 'dark', track() { }, reopen() { } });
const BLOCKED = Object.freeze({ state: 'blocked', track() { }, reopen() { } });
/** GA4 measurement ids are `G-` and ten or so capitals and digits. Strict, because the id goes into a URL. */
export function validId(id) {
    return typeof id === 'string' && /^G-[A-Z0-9]{6,12}$/.test(id) ? id : null;
}
const COOKIE_PREFIX = 'groupit';
const COOKIE_LIFETIME_S = 390 * 24 * 60 * 60;
const MAX_EVENTS_PER_PAGE = 40;
const MAX_HELD = 12;
/** Remove this site's analytics cookies, and only these: the host is shared, so a bare `_ga` is not ours to touch. */
function clearCookies(env) {
    for (const name of env.cookies.names())
        if (name.startsWith(COOKIE_PREFIX + '_ga')) {
            env.cookies.expire(name, env.basePath);
            env.cookies.expire(name, '/');
        }
}
export function createAnalytics(env) {
    // Rule 1: nothing is touched until the id has been checked, and not even then if it is bad.
    const id = validId(env.id);
    if (id === null)
        return INERT;
    // Rule 3: a browser that says no, means no.
    if (env.signal() !== null) {
        clearCookies(env);
        return BLOCKED;
    }
    const page = env.page;
    const where = env.where();
    let state = readChoice(env.store, env.now()) ?? 'unknown';
    let loaded = false;
    let sent = 0;
    const held = [];
    const gtag = (...args) => env.google.gtag(...args);
    function addressFields() {
        const ref = safeReferrer(env.referrer(), where.origin);
        return {
            page_location: safeLocation(where, env.basePath, page),
            page_title: PAGE_TITLES[page],
            ...(ref === '' ? {} : { page_referrer: ref }),
        };
    }
    function send(name, params) {
        if (sent >= MAX_EVENTS_PER_PAGE)
            return;
        sent++;
        gtag('event', name, { ...params, ...addressFields() });
    }
    function pageViewParams() {
        return { page_kind: page, from: referrerCategory(env.referrer(), where.origin) };
    }
    function loadGoogle() {
        if (loaded) { // consent came back after being withdrawn on this page
            env.google.setFlag('ga-disable-' + id, false);
            gtag('consent', 'update', { analytics_storage: 'granted' });
            return;
        }
        loaded = true;
        // Consent Mode v2, in Google's documented order. Everything denied first; the one thing the visitor
        // agreed to is then granted; the three advertising signals stay denied for good (there are no ads here).
        gtag('consent', 'default', {
            ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
        });
        gtag('js', new Date(env.now()));
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('config', id, {
            send_page_view: false, // the page_view is sent by hand below, with an address we built
            allow_google_signals: false, // no advertising features, whatever the property is set to
            allow_ad_personalization_signals: false,
            cookie_prefix: COOKIE_PREFIX, // groupit_ga, groupit_ga_<id>: never a bare _ga another site could read
            cookie_path: env.basePath, // only under /groupit/, on a host shared with the studio's other sites
            cookie_flags: 'SameSite=Lax;Secure',
            cookie_expires: COOKIE_LIFETIME_S, // 13 months, not Google's default two years
            ...addressFields(), // set here too, so an event this module did not build still carries OUR address
        });
        env.google.addScript('https://www.googletagmanager.com/gtag/js?id=' + id);
    }
    function enable() {
        loadGoogle();
        send('page_view', pageViewParams());
        for (const [name, params] of held.splice(0))
            send(name, params);
    }
    function withdraw() {
        if (loaded) {
            env.google.setFlag('ga-disable-' + id, true);
            gtag('consent', 'update', { analytics_storage: 'denied' });
        }
        clearCookies(env);
        held.length = 0;
    }
    const handlers = {
        accept() {
            writeChoice(env.store, 'granted', env.now());
            const was = state;
            state = 'granted';
            env.ui.hideBanner();
            if (was !== 'granted')
                enable();
        },
        decline() {
            writeChoice(env.store, 'denied', env.now());
            const was = state;
            state = 'denied';
            env.ui.hideBanner();
            if (was === 'granted')
                withdraw();
            else
                held.length = 0;
        },
        dismiss() { env.ui.hideBanner(); }, // no answer given: the question comes back on the next page
    };
    const options = (reopened) => ({ current: state, reopened, policyUrl: env.policyUrl, page });
    // Rule 6: until there is an answer, what happens on the page waits in memory (the page_view is not held:
    // it is built and sent by enable(), first, on Accept).
    if (state === 'granted')
        enable();
    else if (state === 'unknown')
        env.ui.showBanner(handlers, options(false)); // enable() sends the page_view on Accept
    env.ui.addFooterControl(() => env.ui.showBanner(handlers, options(true)));
    return {
        get state() { return state; },
        track(name, params) {
            if (state === 'denied')
                return;
            const clean = sanitise(name, params);
            if (clean === null)
                return;
            if (state === 'unknown') {
                if (held.length < MAX_HELD)
                    held.push([name, clean]);
                return;
            }
            send(name, clean);
        },
        reopen() { env.ui.showBanner(handlers, options(true)); },
    };
}
// ── the browser ────────────────────────────────────────────────────────────────────────────────────
function browserStore() {
    return {
        get: k => { try {
            return localStorage.getItem(k);
        }
        catch {
            return null;
        } },
        set: (k, v) => { try {
            localStorage.setItem(k, v);
        }
        catch { /* private window: this page only */ } },
        remove: k => { try {
            localStorage.removeItem(k);
        }
        catch { /* nothing to do */ } },
    };
}
/** The one place that reaches for a global. */
export function browserEnv(page, id) {
    // This module lives at <base>app/ui/analytics.js, so two levels up is the site's base path:
    // /groupit/ on Pages, / on a local server, and whatever a custom domain gives it later.
    const base = new URL('../../', import.meta.url);
    const w = window;
    let banner = null;
    const lazyBanner = () => (banner ??= import('./analyticsBanner.js'));
    const doc = document; // the banner needs a narrow slice of Document (see analyticsBanner.ts)
    return {
        id, page,
        now: () => Date.now(),
        store: browserStore(),
        signal: () => {
            const n = navigator;
            if (n.globalPrivacyControl === true)
                return 'gpc';
            const dnt = n.doNotTrack ?? w.doNotTrack ?? n.msDoNotTrack;
            return dnt === '1' || dnt === 'yes' ? 'dnt' : null;
        },
        // Not `location.href`, not `location.hash`: the fragment is not even a field of Where.
        where: () => ({ origin: location.origin, hostname: location.hostname, search: location.search }),
        referrer: () => document.referrer,
        basePath: base.pathname,
        policyUrl: new URL('privacy-policy.html', base).href,
        cookies: {
            names: () => document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => n !== ''),
            expire: (name, path) => {
                // Expired twice, once host-only and once with the host as its domain, because Google writes the second.
                document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax; Secure`;
                document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${location.hostname}; SameSite=Lax; Secure`;
            },
        },
        google: {
            gtag: function () {
                // Google's own snippet pushes the `arguments` object; an array is silently ignored by gtag.js.
                const layer = (w.dataLayer ??= []);
                // eslint-disable-next-line prefer-rest-params
                layer.push(arguments);
            },
            setFlag: (name, value) => { w[name] = value; },
            addScript: src => {
                const s = document.createElement('script');
                s.async = true;
                s.src = src;
                s.referrerPolicy = 'no-referrer';
                document.head.appendChild(s);
            },
        },
        ui: {
            showBanner: (handlers, options) => { lazyBanner().then(m => m.showBanner(doc, handlers, options), () => { }); },
            hideBanner: () => { lazyBanner().then(m => m.hideBanner(doc), () => { }); },
            addFooterControl: onClick => { lazyBanner().then(m => m.addFooterControl(doc, onClick), () => { }); },
        },
    };
}
let current = INERT;
/**
 * Start analytics for this page. Called once, first thing in a page's `main()`. With no measurement id
 * this returns at once and does nothing else, which is the shipped state.
 */
export function start(page, id = MEASUREMENT_ID) {
    if (validId(id) === null) {
        current = INERT;
        return current;
    }
    current = createAnalytics(browserEnv(page, id));
    if (current.state !== 'dark' && current.state !== 'blocked') {
        // One listener for every marked button on the page: the page's own code does not know analytics exists.
        document.addEventListener('click', e => {
            const hit = readClick(e.target instanceof Element ? e.target : null, page);
            if (hit !== null)
                current.track(hit.name, hit.params);
        });
    }
    return current;
}
/** Report an event from anywhere in the page. A no-op until `start` has run, and while the module is dark. */
export function track(name, params) {
    current.track(name, params);
}
//# sourceMappingURL=analytics.js.map