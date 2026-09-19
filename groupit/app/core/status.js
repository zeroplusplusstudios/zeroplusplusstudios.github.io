// The verdict object `evaluate` fills in. Ported from the nested ClueEval.Status class in
// Assets/_Project/Scripts/Core/Model/ClueEval.cs.
//
// IT LIVES IN ITS OWN MODULE RATHER THAN INSIDE clueEval.ts, and that is a real fix rather
// than tidiness. The C# has one file where TypeScript needs two — mechanicRules is called BY
// clueEval and is handed clueEval's own Status — so keeping Status in clueEval.ts makes the
// two modules import each other. TypeScript resolves that cycle for the types and then fails
// to infer through it: `tsc` reported TS7022 "implicitly has type any because it is referenced
// directly or indirectly in its own initializer" on two locals in mechanicRules that have
// nothing to do with Status. Annotating those locals would have silenced the symptom and left
// the cycle for the next person to trip over.
/** What `evaluate` found. Arrays are caller-owned scratch, reused per frame. */
export class Status {
    /** every cell committed */
    complete = false;
    /** complete AND every clue and law satisfied */
    solved = false;
    /** cells the player has marked */
    committed = 0;
    /** per clue index — provably violated right now */
    clueBroken = new Uint8Array(0);
    /** per cell index — belongs to a violating region or law breach */
    cellBroken = new Uint8Array(0);
    /**
     * Per cell index — this cell's PATCH disagrees with a size clue printed on it.
     *
     * A narrower fact than cellBroken and a different one from clueBroken. A Double carries two
     * claims under one number: the patch is Value cells AND the ray holds Value+1 runs. The
     * shine spends a gold sweep on the PATCH half alone, and paying that over a board the game
     * is simultaneously reddening for a wrong RAY is the failure this splits apart.
     *
     * Set only by the region pass, which runs before the ray pass, so it can never be
     * contaminated by a ray verdict.
     */
    patchBroken = new Uint8Array(0);
    brokenClueCount = 0;
    /** law breaches; laws have no clue index */
    brokenLawCount = 0;
    reset(cells, clues) {
        if (this.clueBroken.length !== clues)
            this.clueBroken = new Uint8Array(clues);
        else
            this.clueBroken.fill(0);
        if (this.cellBroken.length !== cells)
            this.cellBroken = new Uint8Array(cells);
        else
            this.cellBroken.fill(0);
        if (this.patchBroken.length !== cells)
            this.patchBroken = new Uint8Array(cells);
        else
            this.patchBroken.fill(0);
        this.complete = false;
        this.solved = false;
        this.committed = 0;
        this.brokenClueCount = 0;
        this.brokenLawCount = 0;
    }
}
//# sourceMappingURL=status.js.map