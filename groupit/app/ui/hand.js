import * as W from '../content/walkthrough.js';
const HandFace = '#FAFAF7';
const HandLine = '#1B1D22';
const Star = '#FFC23D';
const HandPath = 'M15 2C18 2 20 4 20 7L20 20C21 18.5 23 18 24.5 18.5C26 17 29 17 30 19C31.5 18 34 18.5 35 20.5' +
    'C37 20 39 21.5 39 24L39 36C39 44 34 50 26 50L20 50C14 50 10 46 8 41L3 31C2 29 3 26.5 5.5 26' +
    'C7.5 25.5 9 26.5 10 28L10 7C10 4 12 2 15 2Z';
const TipX = 15 / 42, TipY = 2 / 52;
const SVGNS = 'http://www.w3.org/2000/svg';
function reducedMotion() {
    try {
        return matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    catch {
        return false;
    }
}
const outCubic = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export class GhostHand {
    layer;
    #root;
    #hand;
    #shadow;
    #ripple;
    #track;
    #fill;
    #raf = 0;
    #done = null;
    #timer;
    constructor(layer) {
        this.layer = layer;
        const root = document.createElement('div');
        root.className = 'gt-hand-root';
        root.setAttribute('aria-hidden', 'true');
        root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:5';
        const ripple = document.createElement('div');
        ripple.style.cssText = `position:absolute;border-radius:50%;border:3px solid ${HandFace};` +
            'box-shadow:0 0 0 1px rgba(27,29,34,.35);display:none;transform:translate(-50%,-50%)';
        root.appendChild(ripple);
        const track = document.createElementNS(SVGNS, 'svg');
        track.setAttribute('viewBox', '0 0 100 100');
        track.style.cssText = 'position:absolute;display:none;transform:translate(-50%,-50%);overflow:visible';
        const back = document.createElementNS(SVGNS, 'circle');
        back.setAttribute('cx', '50');
        back.setAttribute('cy', '50');
        back.setAttribute('r', '44');
        back.setAttribute('fill', 'none');
        back.setAttribute('stroke', HandFace);
        back.setAttribute('stroke-opacity', '0.35');
        back.setAttribute('stroke-width', '8');
        const fill = document.createElementNS(SVGNS, 'circle');
        fill.setAttribute('cx', '50');
        fill.setAttribute('cy', '50');
        fill.setAttribute('r', '44');
        fill.setAttribute('fill', 'none');
        fill.setAttribute('stroke', Star);
        fill.setAttribute('stroke-width', '8');
        fill.setAttribute('stroke-linecap', 'round');
        fill.setAttribute('transform', 'rotate(-90 50 50)');
        const around = 2 * Math.PI * 44;
        fill.setAttribute('stroke-dasharray', `${around} ${around}`);
        fill.setAttribute('stroke-dashoffset', String(around));
        track.append(back, fill);
        root.appendChild(track);
        const hand = document.createElementNS(SVGNS, 'svg');
        hand.setAttribute('viewBox', '0 0 42 52');
        hand.style.cssText = 'position:absolute;display:none;overflow:visible;transform-origin:' +
            `${TipX * 100}% ${TipY * 100}%`;
        const shadow = document.createElementNS(SVGNS, 'path');
        shadow.setAttribute('d', HandPath);
        shadow.setAttribute('fill', 'rgba(0,0,0,.35)');
        const face = document.createElementNS(SVGNS, 'path');
        face.setAttribute('d', HandPath);
        face.setAttribute('fill', HandFace);
        face.setAttribute('stroke', HandLine);
        face.setAttribute('stroke-width', '2.2');
        face.setAttribute('stroke-linejoin', 'round');
        hand.append(shadow, face);
        root.appendChild(hand);
        layer.appendChild(root);
        this.#root = root;
        this.#hand = hand;
        this.#shadow = shadow;
        this.#ripple = ripple;
        this.#track = track;
        this.#fill = fill;
    }
    get showing() { return this.#done !== null; }
    play(target, hold) {
        this.stop();
        if (target === null)
            return Promise.resolve();
        return new Promise((resolve) => {
            this.#done = resolve;
            const box = this.layer.getBoundingClientRect();
            const tipX = target.left + target.width / 2 - box.left;
            const tipY = target.top + target.height / 2 - box.top;
            const size = Math.max(40, Math.min(96, Math.min(target.width, target.height) * 0.84));
            const asideX = tipX + size * 0.94, asideY = tipY + size * 1.06;
            if (reducedMotion()) {
                this.#show(tipX, tipY, size, 1, 1);
                if (hold)
                    this.#ring(tipX, tipY, size, 1);
                else
                    this.#rippleAt(tipX, tipY, size, 0.25);
                this.#timer = setTimeout(() => this.stop(), 1100);
                return;
            }
            const holdFor = Math.max(0.45, W.MinHold);
            const phases = hold
                ? [W.Glide, W.PressTime, holdFor, 0.12, W.Release, W.Linger, W.Leave]
                : [W.Glide, W.PressTime, W.TapBody, 0, W.Release, W.Linger, W.Leave];
            const ends = [];
            phases.reduce((at, d, k) => (ends[k] = at + d), 0);
            const started = performance.now();
            let rippleAt = -1;
            const frame = () => {
                const t = (performance.now() - started) / 1000;
                const k = ends.findIndex((e) => t < e);
                if (k < 0) {
                    this.stop();
                    return;
                }
                const from = k === 0 ? 0 : ends[k - 1];
                const u = phases[k] > 0 ? (t - from) / phases[k] : 1;
                const squash = 0.9;
                switch (k) {
                    case 0: {
                        const e = outCubic(u);
                        this.#show(asideX + (tipX - asideX) * e, asideY + (tipY - asideY) * e, size, 1, e);
                        break;
                    }
                    case 1:
                        this.#show(tipX, tipY, size, 1 + (squash - 1) * u, 1);
                        break;
                    case 2:
                        this.#show(tipX, tipY, size, squash, 1);
                        if (hold)
                            this.#ring(tipX, tipY, size, u);
                        else {
                            if (rippleAt < 0)
                                rippleAt = t;
                        }
                        break;
                    case 3:
                        this.#ring(tipX, tipY, size, 1);
                        break;
                    case 4:
                        this.#hideRing();
                        this.#show(tipX, tipY, size, squash + (1 - squash) * u, 1);
                        break;
                    case 5: break;
                    case 6: {
                        const e = outCubic(u) * 0.5;
                        this.#show(tipX + (asideX - tipX) * e, tipY + (asideY - tipY) * e, size, 1, 1 - u);
                        break;
                    }
                }
                if (!hold && rippleAt >= 0)
                    this.#rippleAt(tipX, tipY, size, (t - rippleAt) / W.RippleTime);
                this.#raf = requestAnimationFrame(frame);
            };
            this.#raf = requestAnimationFrame(frame);
        });
    }
    stop() {
        cancelAnimationFrame(this.#raf);
        clearTimeout(this.#timer);
        this.#hand.style.display = 'none';
        this.#ripple.style.display = 'none';
        this.#hideRing();
        const done = this.#done;
        this.#done = null;
        done?.();
    }
    dispose() {
        this.stop();
        this.#root.remove();
    }
    #show(tipX, tipY, size, scale, alpha) {
        const h = this.#hand;
        const w = size, hgt = size * 52 / 42;
        h.style.display = 'block';
        h.style.width = `${w}px`;
        h.style.height = `${hgt}px`;
        h.style.left = `${tipX - w * TipX}px`;
        h.style.top = `${tipY - hgt * TipY}px`;
        h.style.transform = `scale(${scale})`;
        h.style.opacity = String(alpha);
        const down = Math.min(1, Math.max(0, (1 - scale) / 0.1));
        const off = 1.4 * (1 - 0.65 * down);
        this.#shadow.setAttribute('transform', `translate(${off} ${off * 1.3})`);
    }
    #rippleAt(x, y, size, t) {
        const r = this.#ripple;
        if (t > 1 || t < 0) {
            r.style.display = 'none';
            return;
        }
        const d = size * (0.275 + (0.94 - 0.275) * outCubic(t));
        r.style.display = 'block';
        r.style.left = `${x}px`;
        r.style.top = `${y}px`;
        r.style.width = `${d}px`;
        r.style.height = `${d}px`;
        r.style.opacity = String(0.9 * (1 - t));
    }
    #ring(x, y, size, fill) {
        const s = this.#track;
        const d = size * 0.8;
        s.style.display = 'block';
        s.style.left = `${x}px`;
        s.style.top = `${y}px`;
        s.style.width = `${d}px`;
        s.style.height = `${d}px`;
        const around = 2 * Math.PI * 44;
        this.#fill.setAttribute('stroke-dashoffset', String(around * (1 - Math.min(1, Math.max(0, fill)))));
    }
    #hideRing() { this.#track.style.display = 'none'; }
}
