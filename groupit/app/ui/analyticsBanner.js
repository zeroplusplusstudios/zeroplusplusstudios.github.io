export const COPY = {
    title: 'Count this visit?',
    body: 'We would like to use Google Analytics to count visits and see which pages get used, so we can improve ' +
        'GroupIt. It sets a cookie. It never sees your board, the link you opened or anything you type. ' +
        'If you say no, nothing is sent.',
    link: 'How this works',
    accept: 'Accept',
    decline: 'Decline',
    footer: 'Analytics choices',
    status: { granted: 'Your choice now: counting is on.', denied: 'Your choice now: counting is off.', unknown: '', dark: '', blocked: '' },
};
export const BANNER_ID = 'groupit-analytics-banner';
export const FOOTER_BUTTON_ID = 'groupit-analytics-choices';
const LIGHT = { panel: '#FFFFFF', ink: '#1B1D22', line: '#E1E0D8' };
const DARK = { panel: '#262930', ink: '#F0F1EC', line: '#333740' };
function colours(doc, options) {
    let dark = options.page === 'play';
    try {
        dark ||= doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    }
    catch { }
    const f = dark ? DARK : LIGHT;
    return { panel: `var(--panel, ${f.panel})`, ink: `var(--ink, ${f.ink})`, line: `var(--line, ${f.line})` };
}
function set(el, styles) {
    for (const [name, value] of Object.entries(styles))
        el.style.setProperty(name, value);
}
export function buttonStyles(c) {
    return {
        'flex': '1 1 0', 'min-height': '44px', 'padding': '0 16px', 'margin': '0',
        'font-family': 'inherit', 'font-size': '1rem', 'font-weight': '700', 'line-height': '1.2',
        'color': c.ink, 'background': c.panel,
        'border': `2px solid ${c.ink}`, 'border-radius': '10px', 'cursor': 'pointer',
    };
}
function button(doc, label, c, onClick) {
    const b = doc.createElement('button');
    b.setAttribute('type', 'button');
    b.textContent = label;
    set(b, buttonStyles(c));
    b.addEventListener('click', onClick);
    return b;
}
function text(doc, tag, content, styles, id) {
    const e = doc.createElement(tag);
    e.textContent = content;
    if (id !== undefined)
        e.setAttribute('id', id);
    set(e, styles);
    return e;
}
const returnTo = new WeakMap();
export function hideBanner(doc) {
    const root = doc.getElementById(BANNER_ID);
    if (root === null)
        return;
    root.remove();
    doc.body.style.setProperty('padding-bottom', '');
    const back = returnTo.get(root);
    returnTo.delete(root);
    try {
        back?.focus();
    }
    catch { }
}
export function showBanner(doc, handlers, options) {
    const existing = doc.getElementById(BANNER_ID);
    if (existing !== null) {
        if (options.reopened)
            existing.focus();
        return;
    }
    const c = colours(doc, options);
    const root = doc.createElement('div');
    root.setAttribute('id', BANNER_ID);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'false');
    root.setAttribute('aria-labelledby', BANNER_ID + '-title');
    root.setAttribute('aria-describedby', BANNER_ID + '-body');
    root.setAttribute('tabindex', '-1');
    set(root, {
        'position': 'fixed', 'left': '0', 'right': '0', 'bottom': '0', 'z-index': '2147483000',
        'box-sizing': 'border-box', 'padding': '14px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
        'background': c.panel, 'color': c.ink, 'border-top': `1px solid ${c.line}`,
        'box-shadow': '0 -4px 24px rgba(0, 0, 0, .18)',
        'font': '400 0.9375rem/1.45 "Nunito", ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    });
    const inner = doc.createElement('div');
    set(inner, { 'max-width': '40rem', 'margin': '0 auto', 'display': 'flex', 'flex-direction': 'column', 'gap': '10px' });
    inner.appendChild(text(doc, 'p', COPY.title, { 'margin': '0', 'font-weight': '800', 'font-size': '1.0625rem' }, BANNER_ID + '-title'));
    const body = text(doc, 'p', COPY.body + ' ', { 'margin': '0' }, BANNER_ID + '-body');
    const more = doc.createElement('a');
    more.setAttribute('href', options.policyUrl);
    more.textContent = COPY.link;
    set(more, { 'color': c.ink, 'text-decoration': 'underline', 'white-space': 'nowrap' });
    body.appendChild(more);
    inner.appendChild(body);
    const status = COPY.status[options.current];
    if (status !== '')
        inner.appendChild(text(doc, 'p', status, { 'margin': '0', 'font-weight': '700' }));
    const row = doc.createElement('div');
    set(row, { 'display': 'flex', 'gap': '12px' });
    row.appendChild(button(doc, COPY.decline, c, () => handlers.decline()));
    row.appendChild(button(doc, COPY.accept, c, () => handlers.accept()));
    inner.appendChild(row);
    root.appendChild(inner);
    root.addEventListener('keydown', e => { if (e.key === 'Escape')
        handlers.dismiss(); });
    returnTo.set(root, options.reopened ? (doc.activeElement ?? null) : null);
    doc.body.appendChild(root);
    if (options.page !== 'play' && typeof root.offsetHeight === 'number' && root.offsetHeight > 0)
        doc.body.style.setProperty('padding-bottom', `${root.offsetHeight}px`);
    if (options.reopened)
        root.focus();
}
export function addFooterControl(doc, onClick) {
    if (doc.getElementById(FOOTER_BUTTON_ID) !== null)
        return;
    const footer = doc.querySelector('footer .wrap') ?? doc.querySelector('footer');
    if (footer === null)
        return;
    const sep = doc.createElement('span');
    sep.textContent = ' · ';
    const b = doc.createElement('button');
    b.setAttribute('id', FOOTER_BUTTON_ID);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-haspopup', 'dialog');
    b.textContent = COPY.footer;
    set(b, { 'background': 'none', 'border': '0', 'padding': '0', 'margin': '0', 'font': 'inherit',
        'color': 'inherit', 'text-decoration': 'underline', 'cursor': 'pointer' });
    b.addEventListener('click', onClick);
    footer.appendChild(sep);
    footer.appendChild(b);
}
