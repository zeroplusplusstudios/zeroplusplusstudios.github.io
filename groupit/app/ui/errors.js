// How the pages treat an error: what a player is told, and what is only logged.
//
// Pure on purpose — no DOM at import, so test/errors.ts can run it in Node. play.ts and landing.ts
// both start `main()` the moment they load, which is why none of this lives in them.
/**
 * True when `navigator.share` rejected because the PLAYER closed the share sheet.
 *
 * That is a choice, not a failure: the sheet's own Cancel rejects with an `AbortError`
 * DOMException. The handler used to treat every rejection as "sharing is unavailable" and fall
 * through to the clipboard — and, where the clipboard is refused, to a `prompt('Copy this link:')` —
 * so cancelling the iOS share sheet opened a second dialog nobody had asked for (found 2026-10-05
 * on the iPhone simulator). Only a real failure (NotAllowedError, DataError, ...) or a missing
 * `navigator.share` goes on to the copy fallback.
 *
 * Matched on `name`, not `instanceof DOMException`: a browser may reject with a plain Error that
 * carries the name, and the name is the contract MDN documents.
 */
export function isShareDismissed(e) {
    return typeof e === 'object' && e !== null && e.name === 'AbortError';
}
/** The engine's reason for an error, for the console. Never for the page. */
export function reasonOf(e) {
    return e instanceof Error ? e.message : String(e);
}
const COPY = {
    link: {
        title: 'This link is not a board',
        body: 'It may have been cut short when it was sent, or it may be from a newer version of the ' +
            'game than this page understands.',
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
/**
 * The card for a failure, and the reason in the console.
 *
 * 2026-10-05: the cards used to end with the engine's own sentence in brackets — "(board link payload
 * has an impossible length)", "(board link payload is not deflate data)" — which tells a player
 * nothing they can act on and reads like a fault in their phone. The friendly sentence stays; the
 * reason goes to `console.warn`, where whoever is debugging a bad link can still find it. Every
 * message on the page is a constant here, so no exception text can reach a card by another route
 * (test/sharechain.ts fails if a page reads `.message` itself).
 */
export function explain(kind, e) {
    console.warn(`GroupIt: ${kind} problem — ${reasonOf(e)}`);
    return COPY[kind];
}
//# sourceMappingURL=errors.js.map