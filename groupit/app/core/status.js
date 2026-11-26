export class Status {
    complete = false;
    solved = false;
    committed = 0;
    clueBroken = new Uint8Array(0);
    cellBroken = new Uint8Array(0);
    patchBroken = new Uint8Array(0);
    brokenClueCount = 0;
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
