// The landing page's board, in its own module so it can be checked without a DOM.
//
// It lived in landing.ts first, and landing.ts runs the page on import — so the test that
// exists to prove this board is real could not import it without a `document`. A constant the
// test cannot reach is a constant the test does not check.
/**
 * `c1-07`, COPIED VERBATIM from Assets/_Project/Resources/puzzles.txt — a real shipped board
 * from the teaching chapter: 4x4, difficulty 0, six clues on sixteen cells.
 *
 * `test/sample.ts` asserts this exact string still appears in the pack and that its stored
 * solution still verifies. That test exists because the first draft here carried a board written
 * by hand to look plausible: it parsed cleanly, it rendered cleanly, and `verify` returned false.
 * A board on this page that is not a shipped board is a board nobody has proved has exactly one
 * answer — and one answer is the whole promise of the game.
 *
 * Inlined rather than fetched: 90 bytes against a round trip, and the first thing a visitor sees
 * should not wait on a second request.
 */
export const SAMPLE = '4 4 0 c1-07 0 - .##.##.#..####.. R,3,3,L,2 R,2,0,L,2 R,0,1,S,4 R,2,1,L,2 R,1,2,L,1 R,3,0,S,2';
//# sourceMappingURL=sample.js.map