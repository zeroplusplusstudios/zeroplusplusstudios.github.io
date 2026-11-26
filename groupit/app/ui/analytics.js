import { MEASUREMENT_ID } from './analyticsConfig.js';
export const PAGE_KINDS = ['landing', 'board', 'play'];
export const REFERRER_CATEGORIES = ['direct', 'same_site', 'search', 'social', 'app', 'other'];
export const RULE_NAMES = [
    'Tally', 'Colourless', 'Connected', 'Gold', 'Turns', 'Neighbours', 'Rectangles', 'Double', 'Holes',
    'Lamps', 'Sight', 'Knight', 'Crossroads', 'Biggest', 'Pairs', 'Perimeter', 'none',
];
export function ruleValue(name) {
    if (name === null)
        return 'none';
    return RULE_NAMES.includes(name) ? name : undefined;
}
export const DECODE_WHY = ['no_board', 'not_a_link', 'length', 'characters', 'damaged', 'newer', 'browser', 'other'];
export const PLAY_WHY = ['loader', 'engine'];
export const SOLVE_BUCKETS = ['lt30s', '30s_2m', '2m_5m', '5m_15m', 'gt15m'];
export const LOAD_BUCKETS = ['lt5s', '5s_15s', '15s_45s', 'gt45s'];
export const CTAS = ['play_full', 'play_more', 'what_is', 'share_board'];
export const DESTS = ['google_play', 'app_store'];
const SIZE = { int: [1, 40] };
const DIFF = { int: [0, 9] };
export const SPEC = {
    page_view: { page_kind: PAGE_KINDS, from: REFERRER_CATEGORIES },
    web_board_open: { res: ['ok', 'bad_link'], rows: SIZE, cols: SIZE, diff: DIFF, rule: RULE_NAMES, why: DECODE_WHY },
    web_board_solved: { kind: ['shared', 'sample'], rows: SIZE, cols: SIZE, diff: DIFF, rule: RULE_NAMES, tb: SOLVE_BUCKETS, perfect: [0, 1] },
    web_cta: { cta: CTAS, page_kind: PAGE_KINDS },
    web_store_click: { dest: DESTS, page_kind: PAGE_KINDS },
    web_play_ready: { tb: LOAD_BUCKETS },
    web_play_failed: { why: PLAY_WHY },
};
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
export function solveBucket(ms) {
    if (!Number.isFinite(ms) || ms < 0)
        return undefined;
    const s = ms / 1000;
    return s < 30 ? 'lt30s' : s < 120 ? '30s_2m' : s < 300 ? '2m_5m' : s < 900 ? '5m_15m' : 'gt15m';
}
export function loadBucket(ms) {
    if (!Number.isFinite(ms) || ms < 0)
        return undefined;
    const s = ms / 1000;
    return s < 5 ? 'lt5s' : s < 15 ? '5s_15s' : s < 45 ? '15s_45s' : 'gt45s';
}
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
const CAMPAIGN_VALUE = /^[A-Za-z0-9._-]{1,40}$/;
const PAGE_TITLES = {
    landing: 'GroupIt',
    board: 'GroupIt shared board',
    play: 'GroupIt in the browser',
};
const PAGE_PATHS = { landing: '', board: 'b/', play: 'play/' };
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
const SEARCH = [/^(?:[a-z0-9-]+\.)*google\.[a-z.]{2,6}$/, /(?:^|\.)bing\.com$/, /(?:^|\.)duckduckgo\.com$/,
    /(?:^|\.)yahoo\.com$/, /(?:^|\.)ecosia\.org$/, /(?:^|\.)search\.brave\.com$/,
    /(?:^|\.)startpage\.com$/, /(?:^|\.)qwant\.com$/, /(?:^|\.)baidu\.com$/, /(?:^|\.)yandex\.[a-z]{2,3}$/];
const SOCIAL = [/(?:^|\.)facebook\.com$/, /(?:^|\.)instagram\.com$/, /^t\.co$/, /(?:^|\.)twitter\.com$/, /(?:^|\.)x\.com$/,
    /(?:^|\.)reddit\.com$/, /(?:^|\.)linkedin\.com$/, /(?:^|\.)pinterest\.[a-z.]{2,6}$/, /(?:^|\.)tiktok\.com$/,
    /(?:^|\.)youtube\.com$/, /(?:^|\.)threads\.net$/, /(?:^|\.)bsky\.app$/, /(?:^|\.)tumblr\.com$/];
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
export const CONSENT_KEY = 'groupit.analytics.consent';
export const CONSENT_VERSION = 1;
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
    catch { }
}
const INERT = Object.freeze({ state: 'dark', track() { }, reopen() { } });
const BLOCKED = Object.freeze({ state: 'blocked', track() { }, reopen() { } });
export function validId(id) {
    return typeof id === 'string' && /^G-[A-Z0-9]{6,12}$/.test(id) ? id : null;
}
const COOKIE_PREFIX = 'groupit';
const COOKIE_LIFETIME_S = 390 * 24 * 60 * 60;
const MAX_EVENTS_PER_PAGE = 40;
const MAX_HELD = 12;
function clearCookies(env) {
    for (const name of env.cookies.names())
        if (name.startsWith(COOKIE_PREFIX + '_ga')) {
            env.cookies.expire(name, env.basePath);
            env.cookies.expire(name, '/');
        }
}
export function createAnalytics(env) {
    const id = validId(env.id);
    if (id === null)
        return INERT;
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
        if (loaded) {
            env.google.setFlag('ga-disable-' + id, false);
            gtag('consent', 'update', { analytics_storage: 'granted' });
            return;
        }
        loaded = true;
        gtag('consent', 'default', {
            ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
        });
        gtag('js', new Date(env.now()));
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('config', id, {
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            cookie_prefix: COOKIE_PREFIX,
            cookie_path: env.basePath,
            cookie_flags: 'SameSite=Lax;Secure',
            cookie_expires: COOKIE_LIFETIME_S,
            ...addressFields(),
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
        dismiss() { env.ui.hideBanner(); },
    };
    const options = (reopened) => ({ current: state, reopened, policyUrl: env.policyUrl, page });
    if (state === 'granted')
        enable();
    else if (state === 'unknown')
        env.ui.showBanner(handlers, options(false));
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
        catch { } },
        remove: k => { try {
            localStorage.removeItem(k);
        }
        catch { } },
    };
}
export function browserEnv(page, id) {
    const base = new URL('../../', import.meta.url);
    const w = window;
    let banner = null;
    const lazyBanner = () => (banner ??= import('./analyticsBanner.js'));
    const doc = document;
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
        where: () => ({ origin: location.origin, hostname: location.hostname, search: location.search }),
        referrer: () => document.referrer,
        basePath: base.pathname,
        policyUrl: new URL('privacy-policy.html', base).href,
        cookies: {
            names: () => document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => n !== ''),
            expire: (name, path) => {
                document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax; Secure`;
                document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${location.hostname}; SameSite=Lax; Secure`;
            },
        },
        google: {
            gtag: function () {
                const layer = (w.dataLayer ??= []);
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
export function start(page, id = MEASUREMENT_ID) {
    if (validId(id) === null) {
        current = INERT;
        return current;
    }
    current = createAnalytics(browserEnv(page, id));
    if (current.state !== 'dark' && current.state !== 'blocked') {
        document.addEventListener('click', e => {
            const hit = readClick(e.target instanceof Element ? e.target : null, page);
            if (hit !== null)
                current.track(hit.name, hit.params);
        });
    }
    return current;
}
export function track(name, params) {
    current.track(name, params);
}
