let currentResult = null;

// Global Zoom & Pan & Drag State
let currentZoom = { scale: 0.8, x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

let isDraggingCircle = false;
let draggedCircleIndex = -1;

// ===================== Core Layout & Packing Algorithms =====================
function distance(p1, p2) { return Math.hypot(p1.x - p2.x, p1.y - p2.y); }

function solveApollonius3(c1, c2, c3, signs) {
    const results = [];
    const [x1, y1, rr1] = [c1.x, c1.y, c1.r];
    const [x2, y2, rr2] = [c2.x, c2.y, c2.r];
    const [x3, y3, rr3] = [c3.x, c3.y, c3.r];
    const [s1, s2, s3] = signs;
    const k1 = 2 * (s1 * rr1 - s2 * rr2);
    const k2 = 2 * (s1 * rr1 - s3 * rr3);
    const a1 = 2 * (x2 - x1), b1 = 2 * (y2 - y1);
    const d1 = (x2 * x2 + y2 * y2 - rr2 * rr2) - (x1 * x1 + y1 * y1 - rr1 * rr1);
    const a2 = 2 * (x3 - x1), b2 = 2 * (y3 - y1);
    const d2 = (x3 * x3 + y3 * y3 - rr3 * rr3) - (x1 * x1 + y1 * y1 - rr1 * rr1);
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-10) return [];
    const u1 = (b2 * k1 - b1 * k2) / det, v1 = (b2 * d1 - b1 * d2) / det;
    const u2 = (a1 * k2 - a2 * k1) / det, v2 = (a1 * d2 - a2 * d1) / det;
    const dx = v1 - x1, dy = v2 - y1;
    const A = u1 * u1 + u2 * u2 - 1;
    const B = 2 * (u1 * dx + u2 * dy - s1 * rr1);
    const C = dx * dx + dy * dy - rr1 * rr1;
    const accept = (R) => R > 1e-9 && (s1 < 0 ? R > rr1 : true);
    if (Math.abs(A) < 1e-10) {
        if (Math.abs(B) > 1e-10) {
            const R = -C / B;
            if (accept(R)) results.push({ center: { x: u1 * R + v1, y: u2 * R + v2 }, radius: R });
        }
        return results;
    }
    const delta = B * B - 4 * A * C;
    if (delta < 0) return [];
    const sq = Math.sqrt(delta);
    for (const R of [(-B + sq) / (2 * A), (-B - sq) / (2 * A)]) {
        if (accept(R)) results.push({ center: { x: u1 * R + v1, y: u2 * R + v2 }, radius: R });
    }
    return results;
}

function enclosingCircleOfPair(c1, c2) {
    const d = distance(c1, c2);
    const R = (d + c1.r + c2.r) / 2;
    const t = d < 1e-14 ? 0 : (R - c1.r) / d;
    return { center: { x: c1.x + t * (c2.x - c1.x), y: c1.y + t * (c2.y - c1.y) }, radius: R };
}

function minBoundingCircle(circles) {
    const n = circles.length;
    if (n === 1) return { center: { x: circles[0].x, y: circles[0].y }, radius: circles[0].r };
    let best = null;
    const isValid = (cand) => circles.every((c) => distance(cand.center, c) + c.r <= cand.radius + 1e-8);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const cand = enclosingCircleOfPair(circles[i], circles[j]);
        if (isValid(cand) && (!best || cand.radius < best.radius)) best = cand;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
        for (const cand of solveApollonius3(circles[i], circles[j], circles[k], [-1, -1, -1])) {
            if (isValid(cand) && (!best || cand.radius < best.radius)) best = cand;
        }
    }
    if (best) return best;
    let cx = circles.reduce((s, c) => s + c.x, 0) / n, cy = circles.reduce((s, c) => s + c.y, 0) / n;
    for (let t = 1; t <= 5000; t++) {
        let far = circles[0], fv = -1;
        for (const c of circles) { const v = Math.hypot(c.x - cx, c.y - cy) + c.r; if (v > fv) { fv = v; far = c; } }
        cx += (far.x - cx) / (t + 1); cy += (far.y - cy) / (t + 1);
    }
    const R = Math.max(...circles.map((c) => Math.hypot(c.x - cx, c.y - cy) + c.r));
    return { center: { x: cx, y: cy }, radius: R };
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Helper to cluster radii by relative similarity
function clusterRadii(radii, tol) {
    const idx = radii.map((_, i) => i).sort((a, b) => radii[b] - radii[a]);
    const groups = [];
    let cur = null, ref = 0;
    for (const i of idx) {
        if (cur && radii[i] >= ref * (1 - tol)) cur.push(i);
        else { cur = [i]; ref = radii[i]; groups.push(cur); }
    }
    return groups;
}

function makeLayout(N, groups, mode, k) {
    const slots = new Array(N);
    const pk = [];
    let nP = 0, nOrb = 0;
    if (mode === 'free') {
        for (let i = 0; i < N; i++) { slots[i] = { kind: 'free', pi: nP }; pk.push({ t: 'xy', pi: nP }); nP += 2; }
    } else if (mode === 'mirror') {
        let pairs = 0;
        for (const g of groups) {
            const arr = g.slice();
            if (arr.length % 2) {
                const c = arr.splice(Math.floor(arr.length / 2), 1)[0];
                slots[c] = { kind: 'axis', pi: nP }; pk.push({ t: 'y', pi: nP }); nP += 1;
            }
            for (let s = 0; s < arr.length; s += 2) {
                slots[arr[s]] = { kind: 'mA', pi: nP };
                slots[arr[s + 1]] = { kind: 'mB', pi: nP };
                pk.push({ t: 'xy', pi: nP }); nP += 2; pairs++;
            }
        }
        if (pairs === 0 && N > 2) return null;
    } else if (mode === 'rot' || mode === 'dih') {
        const fixed = mode === 'dih';
        let center = -1;
        for (const g of groups) {
            const arr = g.slice();
            const rem = arr.length % k;
            if (rem) {
                if (rem !== 1 || center !== -1) return null;
                center = arr.splice(Math.floor(arr.length / 2), 1)[0];
            }
            for (let s = 0; s < arr.length; s += k) {
                for (let j = 0; j < k; j++) {
                    const ang = 2 * Math.PI * j / k;
                    slots[arr[s + j]] = fixed ? { kind: 'orbitF', pi: nP, ang, orb: nOrb } : { kind: 'orbit', pi: nP, ang };
                }
                if (fixed) { pk.push({ t: 'r', pi: nP }); nP += 1; nOrb++; }
                else { pk.push({ t: 'rt', pi: nP }); nP += 2; }
            }
        }
        if (center !== -1) slots[center] = { kind: 'center' };
    }
    return { mode, k, slots, pk, nParams: nP, nOrb, phases: mode === 'dih' ? new Float64Array(nOrb) : null };
}

function randomParams(layout, R, rng) {
    const p = new Float64Array(layout.nParams);
    for (const g of layout.pk) {
        if (g.t === 'xy') {
            const a = rng() * 2 * Math.PI, rr = R * 0.6 * Math.sqrt(rng());
            p[g.pi] = rr * Math.cos(a); p[g.pi + 1] = rr * Math.sin(a);
        } else if (g.t === 'y') {
            p[g.pi] = (rng() * 2 - 1) * R * 0.6;
        } else if (g.t === 'r') {
            p[g.pi] = R * 0.6 * Math.sqrt(rng());
        } else {
            p[g.pi] = R * 0.6 * Math.sqrt(rng()); p[g.pi + 1] = rng() * 2 * Math.PI;
        }
    }
    return p;
}

function perturb(p, layout, sig, rng) {
    const q = Float64Array.from(p);
    const u = () => (rng() * 2 - 1);
    for (const g of layout.pk) {
        if (g.t === 'xy') { q[g.pi] += u() * sig; q[g.pi + 1] += u() * sig; }
        else if (g.t === 'y' || g.t === 'r') { q[g.pi] += u() * sig; }
        else { q[g.pi] += u() * sig; q[g.pi + 1] += u() * sig / Math.max(Math.abs(q[g.pi]), sig); }
    }
    return q;
}

function makeProblem(radii, layout) {
    const N = radii.length, slots = layout.slots;
    const X = new Float64Array(N), Y = new Float64Array(N);
    const GX = new Float64Array(N), GY = new Float64Array(N);

    function place(p) {
        for (let i = 0; i < N; i++) {
            const s = slots[i];
            switch (s.kind) {
                case 'free': case 'mA': X[i] = p[s.pi]; Y[i] = p[s.pi + 1]; break;
                case 'mB': X[i] = -p[s.pi]; Y[i] = p[s.pi + 1]; break;
                case 'axis': X[i] = 0; Y[i] = p[s.pi]; break;
                case 'orbit': {
                    const a = p[s.pi + 1] + s.ang;
                    X[i] = p[s.pi] * Math.cos(a); Y[i] = p[s.pi] * Math.sin(a); break;
                }
                case 'orbitF': {
                    const a = layout.phases[s.orb] + s.ang;
                    X[i] = p[s.pi] * Math.cos(a); Y[i] = p[s.pi] * Math.sin(a); break;
                }
                default: X[i] = 0; Y[i] = 0;
            }
        }
    }

    function fg(p, grad, Rc) {
        place(p);
        GX.fill(0); GY.fill(0);
        let E = 0;
        for (let i = 0; i < N; i++) {
            const xi = X[i], yi = Y[i], ri = radii[i];
            const di = Math.hypot(xi, yi);
            const v = di + ri - Rc;
            if (v > 0 && di > 1e-12) { E += v * v; GX[i] += 2 * v * xi / di; GY[i] += 2 * v * yi / di; }
            for (let j = i + 1; j < N; j++) {
                let dx = xi - X[j], dy = yi - Y[j];
                const sr = ri + radii[j];
                if (Math.abs(dx) >= sr || Math.abs(dy) >= sr) continue;
                let d = Math.hypot(dx, dy);
                if (d >= sr) continue;
                if (d < 1e-12) { dx = 1e-6; dy = 0; d = 1e-6; }
                const ov = sr - d;
                E += ov * ov;
                const kk = 2 * ov / d;
                GX[i] -= kk * dx; GY[i] -= kk * dy; GX[j] += kk * dx; GY[j] += kk * dy;
            }
        }
        grad.fill(0);
        for (let i = 0; i < N; i++) {
            const s = slots[i], gx = GX[i], gy = GY[i];
            switch (s.kind) {
                case 'free': case 'mA': grad[s.pi] += gx; grad[s.pi + 1] += gy; break;
                case 'mB': grad[s.pi] -= gx; grad[s.pi + 1] += gy; break;
                case 'axis': grad[s.pi] += gy; break;
                case 'orbit': {
                    const a = p[s.pi + 1] + s.ang, c = Math.cos(a), sn = Math.sin(a), rho = p[s.pi];
                    grad[s.pi] += gx * c + gy * sn;
                    grad[s.pi + 1] += rho * (-gx * sn + gy * c);
                    break;
                }
                case 'orbitF': {
                    const a = layout.phases[s.orb] + s.ang;
                    grad[s.pi] += gx * Math.cos(a) + gy * Math.sin(a);
                    break;
                }
            }
        }
        return E;
    }
    return { place, fg, X, Y };
}

function lbfgs(p, fg, maxIter, tolF) {
    const n = p.length, M = 8;
    const g = new Float64Array(n), gn = new Float64Array(n), pn = new Float64Array(n);
    const d = new Float64Array(n), q = new Float64Array(n), alpha = new Float64Array(M);
    const S = [], Y = [], RHO = [];
    let f = fg(p, g), stall = 0, failed = false;
    const dot = (a, b) => { let s = 0; for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; };

    for (let it = 0; it < maxIter && f > tolF; it++) {
        const gg = dot(g, g);
        if (gg < 1e-32) break;
        q.set(g);
        const k = S.length;
        for (let i = k - 1; i >= 0; i--) {
            const a = RHO[i] * dot(S[i], q); alpha[i] = a;
            for (let j = 0; j < n; j++) q[j] -= a * Y[i][j];
        }
        let gamma = 0.5;
        if (k) gamma = dot(S[k - 1], Y[k - 1]) / dot(Y[k - 1], Y[k - 1]);
        for (let j = 0; j < n; j++) q[j] *= gamma;
        for (let i = 0; i < k; i++) {
            const beta = RHO[i] * dot(Y[i], q);
            for (let j = 0; j < n; j++) q[j] += S[i][j] * (alpha[i] - beta);
        }
        for (let j = 0; j < n; j++) d[j] = -q[j];
        let dg = dot(d, g);
        if (dg >= 0) { S.length = Y.length = RHO.length = 0; for (let j = 0; j < n; j++) d[j] = -0.5 * g[j]; dg = -0.5 * gg; }

        let t = 1, fn = f, ls = 0;
        for (; ls < 30; ls++) {
            for (let j = 0; j < n; j++) pn[j] = p[j] + t * d[j];
            fn = fg(pn, gn);
            if (fn <= f + 1e-4 * t * dg) break;
            t *= 0.5;
        }
        if (ls === 30) {
            if (S.length && !failed) { S.length = Y.length = RHO.length = 0; failed = true; continue; }
            break;
        }
        failed = false;
        const s = new Float64Array(n), y = new Float64Array(n);
        for (let j = 0; j < n; j++) { s[j] = pn[j] - p[j]; y[j] = gn[j] - g[j]; }
        const sy = dot(s, y);
        if (sy > 1e-16) {
            S.push(s); Y.push(y); RHO.push(1 / sy);
            if (S.length > M) { S.shift(); Y.shift(); RHO.shift(); }
        }
        stall = (f - fn) <= 1e-13 * f ? stall + 1 : 0;
        p.set(pn); g.set(gn); f = fn;
        if (stall >= 8) break;
    }
    return f;
}

function tryFeasible(prob, p, Rc, o) {
    const q = Float64Array.from(p);
    const f = lbfgs(q, (x, g) => prob.fg(x, g, Rc), o.maxIter, o.tolE);
    return { p: q, f, ok: f <= o.tolE };
}

function shrink(prob, p, hi, lo, o) {
    let best = Float64Array.from(p);
    for (let it = 0; it < 60 && hi - lo > 1e-9 * hi; it++) {
        const mid = 0.5 * (lo + hi);
        const r = tryFeasible(prob, best, mid, o);
        if (r.ok) { hi = mid; best = r.p; } else lo = mid;
    }
    return { p: best, R: hi };
}

function optimizeLayout(radii, layout, rng, opt, starts) {
    const prob = makeProblem(radii, layout);
    const sumR = radii.reduce((a, b) => a + b, 0);
    const sumR2 = radii.reduce((a, b) => a + b * b, 0);
    const rmax = Math.max(...radii), rmed = sumR / radii.length;
    const o = { maxIter: opt.maxIter, tolE: (1e-10 * sumR) ** 2 };
    const lo0 = Math.max(rmax, Math.sqrt(sumR2 / 0.9069));

    const ph = layout.phases;
    const half = Math.PI / layout.k;
    let best = null;
    for (let s = 0; s < starts; s++) {
        if (ph) for (let i = 0; i < ph.length; i++) ph[i] = (i > 0 && rng() < 0.5) ? half : 0;
        let hi = lo0 * 1.2;
        let p = randomParams(layout, hi, rng);
        let ok = false;
        for (let tries = 0; tries < 80; tries++) {
            const r = tryFeasible(prob, p, hi, o);
            p = r.p;
            if (r.ok) { ok = true; break; }
            hi *= 1.15;
        }
        if (!ok) continue;
        const cur = shrink(prob, p, hi, lo0, o);
        if (!best || cur.R < best.R) best = { ...cur, phases: ph ? Float64Array.from(ph) : null };
    }
    if (!best) return null;
    if (ph) ph.set(best.phases);

    for (let h = 0; h < opt.hops; h++) {
        const oldPh = ph ? Float64Array.from(ph) : null;
        if (ph && ph.length > 1 && rng() < 0.3) { const o2 = 1 + Math.floor(rng() * (ph.length - 1)); ph[o2] = ph[o2] === 0 ? half : 0; }
        const pp = perturb(best.p, layout, rmed * (0.2 + 0.6 * rng()), rng);
        const relax = tryFeasible(prob, pp, best.R * 1.03, o);
        if (!relax.ok) { if (ph) ph.set(oldPh); continue; }
        const probe = tryFeasible(prob, relax.p, best.R * (1 - 1e-4), o);
        if (!probe.ok) { if (ph) ph.set(oldPh); continue; }
        const sh = shrink(prob, probe.p, best.R * (1 - 1e-4), Math.max(lo0, best.R * 0.9), o);
        if (sh.R < best.R) best = { ...sh, phases: ph ? Float64Array.from(ph) : null };
        else if (ph) ph.set(oldPh);
    }
    return { p: best.p, phases: best.phases };
}

function finalize(radii, layout, p, groupOf) {
    const prob = makeProblem(radii, layout);
    prob.place(p);
    const N = radii.length;
    const circles = radii.map((r, i) => ({ index: i, group: groupOf[i], r, x: prob.X[i], y: prob.Y[i] }));

    let s = 1;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const d = distance(circles[i], circles[j]);
        if (d > 1e-14) s = Math.max(s, (circles[i].r + circles[j].r) / d);
    }
    if (s > 1) for (const c of circles) { c.x *= s; c.y *= s; }

    const b = minBoundingCircle(circles);
    for (const c of circles) { c.x -= b.center.x; c.y -= b.center.y; }
    const Rb = Math.max(b.radius, ...circles.map((c) => Math.hypot(c.x, c.y) + c.r));
    return { circles, bound: { center: { x: 0, y: 0 }, radius: Rb } };
}

function analyzeSymmetry(circles, Rb, radTol) {
    const n = circles.length;
    const posTol = 1e-4 * Rb;
    const sim = (a, b) => Math.abs(a.r - b.r) <= radTol * Math.max(a.r, b.r);
    const hasMatch = (x, y, c) => circles.some((o) => sim(o, c) && Math.hypot(o.x - x, o.y - y) <= posTol);

    let rot = 1;
    for (let k = n; k >= 2; k--) {
        const a = 2 * Math.PI / k, ca = Math.cos(a), sa = Math.sin(a);
        if (circles.every((c) => hasMatch(c.x * ca - c.y * sa, c.x * sa + c.y * ca, c))) { rot = k; break; }
    }

    const axes = [];
    const off = circles.filter((c) => Math.hypot(c.x, c.y) > posTol);
    const phis = off.map((c) => Math.atan2(c.y, c.x));
    const cand = [];
    for (let i = 0; i < phis.length; i++) {
        cand.push(phis[i]);
        for (let j = i + 1; j < phis.length; j++) cand.push((phis[i] + phis[j]) / 2);
    }
    const modPi = (a) => ((a % Math.PI) + Math.PI) % Math.PI;
    for (const al of cand) {
        const c2 = Math.cos(2 * al), s2 = Math.sin(2 * al);
        if (!circles.every((c) => hasMatch(c.x * c2 + c.y * s2, c.x * s2 - c.y * c2, c))) continue;
        const a = modPi(al);
        if (!axes.some((b) => Math.min(Math.abs(a - b), Math.PI - Math.abs(a - b)) < 1e-6)) axes.push(a);
    }
    return { rotationOrder: rot, mirrorAxes: axes.length, order: rot * (axes.length > 0 ? 2 : 1) };
}

function solveEnclosing(radii, options = {}) {
    const opt = Object.assign({
        similarTol: 0.05, symTol: 0.02, starts: 20, symStarts: 10, hops: 30, maxIter: 300, seed: 1,
    }, options);
    const N = radii.length;
    if (N < 1 || radii.some((r) => !(r > 0))) throw new Error('radii must be a non-empty array of positive numbers');

    const groups = clusterRadii(radii, opt.similarTol);
    const groupOf = new Array(N);
    groups.forEach((g, gi) => g.forEach((i) => { groupOf[i] = gi; }));

    if (N === 1) {
        const circles = [{ index: 0, group: 0, r: radii[0], x: 0, y: 0 }];
        return { circles, boundingCircle: { center: { x: 0, y: 0 }, radius: radii[0] },
            symmetry: { rotationOrder: 1, mirrorAxes: 0, order: 1 }, chosen: 'single', candidates: [], groups };
    }

    const rng = mulberry32(opt.seed);
    const candidates = [];
    const run = (name, layout, starts) => {
        if (!layout || layout.nParams === 0) return;
        const res = optimizeLayout(radii, layout, rng, opt, starts);
        if (!res) return;
        if (layout.phases) layout.phases.set(res.phases);
        const fin = finalize(radii, layout, res.p, groupOf);
        const sym = analyzeSymmetry(fin.circles, fin.bound.radius, opt.similarTol);
        candidates.push({ name, R: fin.bound.radius, symmetry: sym, circles: fin.circles, bound: fin.bound });
    };

    run('free', makeLayout(N, groups, 'free'), opt.starts);
    run('mirror', makeLayout(N, groups, 'mirror'), opt.symStarts);
    for (let k = 2; k <= N; k++) {
        run(`rot${k}`, makeLayout(N, groups, 'rot', k), opt.symStarts);
        const dl = makeLayout(N, groups, 'dih', k);
        if (dl) run(`dih${k}`, dl, Math.max(opt.symStarts, Math.min(2 ** Math.max(dl.nOrb - 1, 0), 32)));
    }

    if (!candidates.length) throw new Error('Optimization failed. Please increase maxIter / starts');

    const Rmin = Math.min(...candidates.map((c) => c.R));
    const eligible = candidates.filter((c) => c.R <= Rmin * (1 + opt.symTol) + 1e-12);
    eligible.sort((a, b) => (b.symmetry.order - a.symmetry.order) || (a.R - b.R));
    const best = eligible[0];

    return {
        circles: best.circles,
        boundingCircle: best.bound,
        symmetry: best.symmetry,
        chosen: best.name,
        candidates: candidates.map((c) => ({ name: c.name, R: c.R, ...c.symmetry })),
        groups,
    };
}

// ===================== Generate SVG with Background Grid =====================
function toSVG(result) {
    const Rb = result.boundingCircle.radius, pad = Rb * 0.1, W = 2 * (Rb + pad);
    const palette = ['#4c78a8', '#f58518', '#54a24b', '#e45756', '#72b7b2', '#b279a2', '#ff9da6', '#9d755d', '#bab0ac'];
    
    // Grid spacing
    const gridSize = Math.pow(10, Math.floor(Math.log10(Rb || 1))) / 2 || 2;

    let s = `<svg id="packing-svg" viewBox="${-Rb - pad} ${-Rb - pad} ${W} ${W}">`;
    s += `<defs>
            <pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse" x="0" y="0">
                <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e2e8f0" stroke-width="${Rb / 400}"/>
            </pattern>
          </defs>`;

    s += `<g id="viewport" transform="translate(0, 0) scale(0.8)">`;
    
    // 1. Background grid and center axes
    s += `<rect x="${(-Rb - pad)*5}" y="${(-Rb - pad)*5}" width="${W*5}" height="${W*5}" fill="url(#grid)" />`;
    s += `<line x1="${-Rb*3}" y1="0" x2="${Rb*3}" y2="0" stroke="#cbd5e1" stroke-width="${Rb / 300}" stroke-dasharray="${Rb/100}"/>`;
    s += `<line x1="0" y1="${-Rb*3}" x2="0" y2="${Rb*3}" stroke="#cbd5e1" stroke-width="${Rb / 300}" stroke-dasharray="${Rb/100}"/>`;

    // 2. Dynamic enclosing circle
    s += `<circle id="bounding-circle" cx="0" cy="0" r="${Rb}" fill="none" stroke="#1e293b" stroke-width="${Rb / 160}" stroke-dasharray="${Rb/80} ${Rb/160}"/>`;
    
    // 3. Draggable circle elements
    for (const c of result.circles) {
        s += `<g class="circle-group" id="circle-group-${c.index}">`;
        s += `<circle id="circle-${c.index}" data-index="${c.index}" class="circle-item" cx="${c.x}" cy="${-c.y}" r="${c.r}" fill="${palette[c.group % palette.length]}" fill-opacity="0.65" stroke="#1e293b" stroke-width="${Rb / 250}">`;
        s += `<title>Circle #${c.index}\nRadius r: ${c.r.toFixed(3)}\nClick and drag to reposition</title></circle>`;
        s += `<text id="label-${c.index}" x="${c.x}" y="${-c.y}" font-size="${Math.max(c.r * 0.5, Rb / 32)}" text-anchor="middle" dominant-baseline="central" fill="#0f172a" font-weight="bold" pointer-events="none">${c.index}</text>`;
        s += `</g>`;
    }
    s += `</g></svg>`;
    return s;
}

// ===================== Coordinate Transform Helper (Screen -> Cartesian) =====================
function getSVGCoords(e, svg, viewport) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    // Screen to SVG coordinate transform
    const globalPoint = pt.matrixTransform(viewport.getScreenCTM().inverse());
    return { x: globalPoint.x, y: -globalPoint.y }; // Invert SVG Y for Cartesian coordinate system
}

// ===================== Drag, Physics Separation & Expand Bounding Circle =====================
function handleCircleDrag(worldPos) {
    if (draggedCircleIndex === -1 || !currentResult) return;

    const circles = currentResult.circles;
    const draggedCircle = circles[draggedCircleIndex];
    
    // 1. Update dragged circle center
    draggedCircle.x = worldPos.x;
    draggedCircle.y = worldPos.y;

    // 2. Physics separation relaxation
    const N = circles.length;
    const iterations = 8; // 8 relaxation iterations for smooth separation
    for (let it = 0; it < iterations; it++) {
        // Push other circles away from dragged circle
        for (let j = 0; j < N; j++) {
            if (j === draggedCircleIndex) continue;
            let dx = circles[j].x - draggedCircle.x;
            let dy = circles[j].y - draggedCircle.y;
            let d = Math.hypot(dx, dy);
            let minD = draggedCircle.r + circles[j].r;
            if (d < minD) {
                if (d < 1e-5) { dx = 1e-3; dy = 0; d = 1e-3; }
                let overlap = minD - d;
                circles[j].x += (dx / d) * overlap;
                circles[j].y += (dy / d) * overlap;
            }
        }
        // Mutual separation between other circles
        for (let j = 0; j < N; j++) {
            if (j === draggedCircleIndex) continue;
            for (let k = j + 1; k < N; k++) {
                if (k === draggedCircleIndex) continue;
                let dx = circles[k].x - circles[j].x;
                let dy = circles[k].y - circles[j].y;
                let d = Math.hypot(dx, dy);
                let minD = circles[j].r + circles[k].r;
                if (d < minD) {
                    if (d < 1e-5) { dx = 1e-3; dy = 0; d = 1e-3; }
                    let overlap = (minD - d) * 0.5;
                    circles[j].x -= (dx / d) * overlap;
                    circles[j].y -= (dy / d) * overlap;
                    circles[k].x += (dx / d) * overlap;
                    circles[k].y += (dy / d) * overlap;
                }
            }
        }
    }

    // 3. Dynamically expand bounding circle
    let maxR = 0;
    for (let i = 0; i < N; i++) {
        let dist = Math.hypot(circles[i].x, circles[i].y) + circles[i].r;
        if (dist > maxR) maxR = dist;
    }
    currentResult.boundingCircle.radius = maxR;

    // 4. Update DOM element positions
    updateDOMPositions();
}

function updateDOMPositions() {
    if (!currentResult) return;
    const circles = currentResult.circles;
    const Rb = currentResult.boundingCircle.radius;

    // Update bounding circle radius
    const boundEl = document.getElementById('bounding-circle');
    if (boundEl) boundEl.setAttribute('r', Rb);

    // Update each circle and its label
    for (const c of circles) {
        const circleEl = document.getElementById(`circle-${c.index}`);
        const labelEl = document.getElementById(`label-${c.index}`);
        if (circleEl) {
            circleEl.setAttribute('cx', c.x);
            circleEl.setAttribute('cy', -c.y);
        }
        if (labelEl) {
            labelEl.setAttribute('x', c.x);
            labelEl.setAttribute('y', -c.y);
        }
    }

    // Update stats UI
    updateStatisticsUI();
}

// Local L-BFGS refinement on mouse release
function refineCurrentLayout() {
    if (!currentResult) return;
    const circles = currentResult.circles;
    const N = circles.length;
    const radii = circles.map(c => c.r);
    
    // Free mode using current dragged positions as start
    const layout = makeLayout(N, currentResult.groups, 'free');
    const prob = makeProblem(radii, layout);
    const p = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
        p[2 * i] = circles[i].x;
        p[2 * i + 1] = circles[i].y;
    }

    const sumR = radii.reduce((a, b) => a + b, 0);
    const o = { maxIter: 200, tolE: (1e-10 * sumR) ** 2 };
    let Rc = currentResult.boundingCircle.radius;

    // Shrink optimization
    const sh = shrink(prob, p, Rc * 1.02, Math.max(...radii), o);
    const fin = finalize(radii, layout, sh.p, circles.map(c => c.group));

    currentResult.circles = fin.circles;
    currentResult.boundingCircle = fin.bound;
    currentResult.chosen = 'Manual Adjustment (Refined)';

    // Refresh UI
    updateDOMPositions();
    fillTable(currentResult.circles);
    updateStatisticsUI();
}

// ===================== Interactive Event Bindings (Pan & Zoom & Drag) =====================
function setupInteractions() {
    const svg = document.getElementById('packing-svg');
    const viewport = document.getElementById('viewport');
    if (!svg || !viewport) return;

    resetZoom();

    // 1. Mouse down: handle circle dragging or background panning
    svg.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only respond to left button

        const target = e.target;
        if (target.classList.contains('circle-item')) {
            // Trigger circle dragging mode
            isDraggingCircle = true;
            draggedCircleIndex = parseInt(target.getAttribute('data-index'));
            target.classList.add('dragging');
        } else {
            // Trigger canvas panning mode
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            svg.classList.add('panning');
        }
    });

    // 2. Mouse move: handle circle drag or canvas pan
    window.addEventListener('mousemove', (e) => {
        if (isDraggingCircle) {
            const worldPos = getSVGCoords(e, svg, viewport);
            handleCircleDrag(worldPos);
        } else if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            const ctm = svg.getScreenCTM();
            if (ctm) {
                const panDamping = 0.5; // Reduced panning amplitude for smoother control
                currentZoom.x += (dx / ctm.a) * panDamping;
                currentZoom.y += (dy / ctm.d) * panDamping;
            }
            panStart = { x: e.clientX, y: e.clientY };
            updateTransform();
        }
    });

    // 3. Mouse up: release drag/pan state and trigger local refinement
    window.addEventListener('mouseup', () => {
        if (isDraggingCircle) {
            const draggedEl = document.getElementById(`circle-${draggedCircleIndex}`);
            if (draggedEl) draggedEl.classList.remove('dragging');
            isDraggingCircle = false;
            draggedCircleIndex = -1;
            
            // Re-refine layout automatically upon release
            refineCurrentLayout();
        }
        if (isPanning) {
            isPanning = false;
            svg.classList.remove('panning');
        }
    });

    // 4. Mouse wheel: zoom in/out with origin
    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        currentZoom.scale = Math.min(Math.max(0.2, currentZoom.scale * zoomFactor), 20);

        updateTransform();
    }, { passive: false });
}

function updateTransform() {
    const viewport = document.getElementById('viewport');
    if (viewport) {
        viewport.setAttribute('transform', `translate(${currentZoom.x}, ${currentZoom.y}) scale(${currentZoom.scale})`);
    }
}

function zoomIn() {
    currentZoom.scale = Math.min(20, currentZoom.scale * 1.25);
    updateTransform();
}

function zoomOut() {
    currentZoom.scale = Math.max(0.2, currentZoom.scale * 0.8);
    updateTransform();
}

function resetZoom() {
    currentZoom = { scale: 0.8, x: 0, y: 0 };
    updateTransform();
}

function updateStatisticsUI() {
    if (!currentResult) return;
    const infoCard = document.getElementById('result-info');
    const radii = currentResult.circles.map(c => c.r);
    const sumR2 = radii.reduce((a, b) => a + b * b, 0);
    const Rb = currentResult.boundingCircle.radius;
    const density = ((sumR2 / (Rb ** 2)) * 100).toFixed(2);

    function translateChosenName(name) {
        if (!name) return '';
        if (name === 'free') return 'Free Layout';
        if (name === 'mirror') return 'Mirror Symmetry';
        if (name === 'single') return 'Single Circle';
        if (name.startsWith('rot')) {
            const k = name.substring(3);
            return `Rotational Symmetry (C${k})`;
        }
        if (name.startsWith('dih')) {
            const k = name.substring(3);
            return `Dihedral Symmetry (D${k})`;
        }
        return name;
    }

    infoCard.style.display = 'block';
    infoCard.innerHTML = `
        <label style="font-weight: bold; font-size: 14px; display: block; margin-bottom: 12px; color: #1e293b;">Calculation Results</label>
        <table class="stats-table">
            <thead>
                <tr>
                    <th style="width: 50%; text-align: center; background-color: #daeef3; color: #073a40;">Layout Metric</th>
                    <th style="width: 50%; text-align: center; background-color: #daeef3; color: #073a40;">Value</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="text-align: center; color: #073a40;">Min Enclosing Radius (R)</td>
                    <td style="text-align: center; font-weight: 700; color: #3042e3;">${Rb.toFixed(4)}</td>
                </tr>
                <tr>
                    <td style="text-align: center; color: #073a40;">Total Circles Count</td>
                    <td style="text-align: center; font-weight: 700; color: #3042e3;">${radii.length}</td>
                </tr>
                <tr>
                    <td style="text-align: center; color: #073a40;">Optimal Symmetry Mode</td>
                    <td style="text-align: center; font-weight: 700; color: #3042e3;">${translateChosenName(currentResult.chosen)}</td>
                </tr>
            </tbody>
        </table>
    `;
}

// ===================== Frontend Page Controls =====================
function setPreset(val) {
    document.getElementById('radii-input').value = val;
    runCalculation();
}

function runCalculation() {
    const btn = document.getElementById('btn-calc');
    const loading = document.getElementById('loading');
    const svgContainer = document.getElementById('svg-stage') || document.getElementById('output-svg');
    const actionBtns = document.getElementById('action-btns');
    const tableContainer = document.getElementById('table-container');
    const placeholder = document.getElementById('placeholder-text');
    const zoomControls = document.getElementById('zoom-controls');
    const hintBanner = document.getElementById('hint-banner');

    btn.disabled = true;
    loading.style.display = 'block';

    setTimeout(() => {
        try {
            const rawInput = document.getElementById('radii-input').value;
            let radii = rawInput.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0);
            
            const isDiameter = document.querySelector('input[name="input-type"]:checked').value === 'diameter';
            if (isDiameter) radii = radii.map(r => r / 2);

            if (radii.length === 0) {
                alert('Please enter at least one valid positive number!');
                return;
            }

            // Dynamically adjust solver starts based on circle count
            let computedStarts = 20; // default 20
            if (radii.length >= 30) {
                computedStarts = 40;
            } else if (radii.length >= 20) {
                computedStarts = 30;
            }

            // Update DOM input to show solver starts
            document.getElementById('starts').value = computedStarts;

            const options = {
                similarTol: parseFloat(document.getElementById('similarTol').value) || 0.05,
                symTol: parseFloat(document.getElementById('symTol').value) || 0.02,
                starts: computedStarts,
                seed: parseInt(document.getElementById('seed').value) || 1
            };

            const res = solveEnclosing(radii, options);
            currentResult = res;

            if (placeholder) placeholder.style.display = 'none';
            zoomControls.style.display = 'flex';
            if (hintBanner) {
                hintBanner.style.display = 'flex';
                hintBanner.textContent = '💡 Drag any circle to adjust • Scroll to zoom • Drag background to pan';
            }
            
            // Clean old SVG and mount new SVG
            const oldSvg = document.getElementById('packing-svg');
            if (oldSvg) oldSvg.remove();
            svgContainer.insertAdjacentHTML('beforeend', toSVG(res));
            
            // Setup interactive events
            setupInteractions();

            updateStatisticsUI();
            fillTable(res.circles);
            actionBtns.style.display = 'flex';
            if (tableContainer) tableContainer.style.display = 'block';

        } catch (err) {
            alert('Calculation error: ' + err.message);
        } finally {
            btn.disabled = false;
            loading.style.display = 'none';
        }
    }, 50);
}

function fillTable(circles) {
    const tbody = document.getElementById('data-table-body');
    if (!tbody) return;
    tbody.innerHTML = circles.map(c => `
        <tr>
            <td><b>#${c.index}</b></td>
            <td>${c.r.toFixed(3)}</td>
            <td>${c.x.toFixed(4)}</td>
            <td>${c.y.toFixed(4)}</td>
            <td>Group ${c.group + 1}</td>
        </tr>
    `).join('');
}

// File export logic
function downloadSVG() {
    const svg = document.querySelector('#output-svg svg');
    if (!svg) return alert('Please calculate layout first!');
    
    const cloneSvg = svg.cloneNode(true);
    const vp = cloneSvg.querySelector('#viewport');
    if (vp) vp.setAttribute('transform', 'translate(0, 0) scale(1)');

    const blob = new Blob([cloneSvg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circle_packing_layout.svg';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadPNG() {
    const svg = document.querySelector('#output-svg svg');
    if (!svg) return alert('Please calculate layout first!');
    
    const cloneSvg = svg.cloneNode(true);
    const vp = cloneSvg.querySelector('#viewport');
    if (vp) vp.setAttribute('transform', 'translate(0, 0) scale(1)');

    const xml = new XMLSerializer().serializeToString(cloneSvg);
    const svgBlob = new Blob([xml], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 1200, 1200);
        const a = document.createElement('a');
        a.download = 'circle_packing_layout.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

function downloadCSV() {
    if (!currentResult) return alert('Please calculate layout first!');
    let csv = '\uFEFFIndex,Radius,CenterX,CenterY,Group\n';
    currentResult.circles.forEach(c => {
        csv += `${c.index},${c.r},${c.x.toFixed(6)},${c.y.toFixed(6)},${c.group + 1}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circle_positions.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// Mount global functions to window object
window.setPreset = setPreset;
window.runCalculation = runCalculation;
window.downloadSVG = downloadSVG;
window.downloadPNG = downloadPNG;
window.downloadCSV = downloadCSV;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;

// Auto-run calculation on load
window.onload = runCalculation;
