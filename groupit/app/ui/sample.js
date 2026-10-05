// The landing page's board, in its own module so it can be checked without a DOM.
//
// It lived in landing.ts first, and landing.ts runs the page on import — so the test that
// exists to prove this board is real could not import it without a `document`. A constant the
// test cannot reach is a constant the test does not check.
/**
 * `c1001-01`, COPIED VERBATIM from Assets/_Project/Resources/endless.txt — a real shipped board,
 * the first of the free-play pool's Pocket row: 4x4, difficulty 0, plain (no rule), six clues on
 * sixteen cells.
 *
 * It was `c1-07` from the campaign pack (puzzles.txt) until 2026-10-02, when the campaign was
 * retired and its pack deleted. Pocket (1001) is the pool's first row and is carried byte for byte
 * by every endless re-bake that does not touch its own settings, so this line stays put.
 *
 * `test/sample.ts` asserts this exact string still appears in the pool and that its stored
 * solution still verifies. That test exists because the first draft here carried a board written
 * by hand to look plausible: it parsed cleanly, it rendered cleanly, and `verify` returned false.
 * A board on this page that is not a shipped board is a board nobody has proved has exactly one
 * answer — and one answer is the whole promise of the game.
 *
 * Inlined rather than fetched: 90 bytes against a round trip, and the first thing a visitor sees
 * should not wait on a second request.
 */
export const SAMPLE = '4 4 0 c1001-01 0 - .#.#.##.#..##.#. R,2,3,S,1 R,0,0,L,2 R,3,1,L,3 R,0,3,S,1 R,2,0,S,2 R,2,1,L,3';
//# sourceMappingURL=sample.js.map