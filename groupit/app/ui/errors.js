import { BrowserTooOldError, FormatError, NewerBoardError } from '../core/puzzle.js';
export function isShareDismissed(e) {
    return typeof e === 'object' && e !== null && e.name === 'AbortError';
}
export function reasonOf(e) {
    return e instanceof Error ? e.message : String(e);
}
export function decodeWhy(e) {
    if (e instanceof NewerBoardError)
        return 'newer';
    if (e instanceof BrowserTooOldError)
        return 'browser';
    const reason = reasonOf(e);
    if (/impossible length/.test(reason))
        return 'length';
    if (/not base64url/.test(reason))
        return 'characters';
    if (/not a GroupIt board link/.test(reason))
        return 'not_a_link';
    return e instanceof FormatError ? 'damaged' : 'other';
}
const COPY = {
    link: {
        title: 'This link is not a board',
        body: 'It may have been cut short when it was sent, or it may be from a newer version of the ' +
            'game than this page understands.',
    },
    newer: {
        title: 'This board needs a newer GroupIt',
        body: 'The link was made by a newer version of the game than this page can open. Update the ' +
            'app, or reload this page in case it has been updated, and try the link again.',
    },
    browser: {
        title: 'This board cannot open here',
        body: 'This browser is too old to open this board link. Try an up-to-date browser.',
    },
    sample: {
        title: 'The sample board would not open',
        body: 'Try reloading the page.',
    },
    page: {
        title: 'Something went wrong',
        body: 'Try reloading the page, or ask whoever sent the link to send it again.',
    },
};
export function troubleOf(e) {
    if (e instanceof NewerBoardError)
        return 'newer';
    if (e instanceof BrowserTooOldError)
        return 'browser';
    return 'link';
}
export function explain(kind, e) {
    console.warn(`GroupIt: ${kind} problem — ${reasonOf(e)}`);
    return COPY[kind];
}
