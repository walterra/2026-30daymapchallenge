/* Occupancy bitmap and greedy placement, following Kittivorawong et al., VIS 2021.
 * https://idl.cs.washington.edu/files/2021-FastLabels-VIS.pdf, sections 3–4.
 * Full-row updates are intentional: connector queries can be one pixel high.
 */
'use strict';
(function (root) {
  // Adjacent outlines can share projected attachment pixels. Full-segment
  // intersection tests below still prohibit real crossings and text cuts.
  const ATTACHMENT_PIXELS = 8;
  class OccupancyBitmap {
    constructor(width, height, data) {
      this.width = Math.ceil(width); this.height = Math.ceil(height);
      this.stride = Math.ceil(this.width / 32);
      this.data = data || new Uint32Array(this.stride * this.height);
      this.journal = [];
    }
    clone() { return new OccupancyBitmap(this.width, this.height, this.data.slice()); }
    checkpoint() { return this.journal.length; }
    rollback(checkpoint) {
      while (this.journal.length > checkpoint) { const value = this.journal.pop(), index = this.journal.pop(); this.data[index] = value; }
    }
    fromAlpha(rgba) {
      for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
        if (rgba[(y * this.width + x) * 4 + 3]) this.data[y * this.stride + (x >>> 5)] |= 1 << (x & 31);
      }
      return this;
    }
    rectangle(rect, mark = false) {
      const x0 = Math.floor(rect.left), y0 = Math.floor(rect.top), x1 = Math.ceil(rect.right), y1 = Math.ceil(rect.bottom);
      if (x0 < 0 || y0 < 0 || x1 > this.width || y1 > this.height) return !mark;
      if (x1 <= x0 || y1 <= y0) return false;
      const first = x0 >>> 5, last = (x1 - 1) >>> 5;
      for (let y = y0; y < y1; y++) for (let word = first; word <= last; word++) {
        const low = word === first ? x0 & 31 : 0, high = word === last ? (x1 - 1) & 31 : 31;
        const mask = ((0xffffffff << low) & (0xffffffff >>> (31 - high))) >>> 0;
        const index = y * this.stride + word;
        if (mark) {
          const before = this.data[index], after = (before | mask) >>> 0;
          if (before !== after) { this.journal.push(index, before); this.data[index] = after; }
        }
        else if (this.data[index] & mask) return true;
      }
      return false;
    }
    line(a, b, radius = 1, mark = false, skip = 0) {
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
      for (let i = 0; i <= steps; i++) {
        if (length * i / steps < skip) continue;
        const x = a.x + dx * i / steps, y = a.y + dy * i / steps;
        if (this.rectangle({ left: Math.floor(x - radius), right: Math.floor(x + radius) + 1, top: Math.floor(y - radius), bottom: Math.floor(y + radius) + 1 }, mark) && !mark) return true;
      }
      return false;
    }
  }
  function greedy(base, cityMask, primaryMask, labels, order, scale = 1, reserveLeaders = true) {
    const dynamic = new OccupancyBitmap(base.width, base.height), placed = [];
    for (const index of order) {
      const label = labels[index];
      for (const candidate of label.candidates) {
        const rect = candidate.pixelRect, a = candidate.pixelAnchor, b = candidate.pixelEnd;
        if (base.rectangle(rect) || dynamic.rectangle(rect)) continue;
        if (reserveLeaders && (cityMask.line(a, b, scale) || dynamic.line(a, b, scale))) continue;
        // The endpoint is an actual boundary vertex. Exempt its local stroke,
        // not the rest of the polygon or another resort along the leader.
        if (reserveLeaders && primaryMask && primaryMask.line(a, b, scale * .6, false, 5 * scale)) continue;
        dynamic.rectangle(rect, true);
        if (reserveLeaders) dynamic.line(a, b, scale, true);
        placed.push({ ...candidate, id: label.id });
        break;
      }
    }
    return placed;
  }
  function polygonCenter(mask, bounds) {
    const left = Math.max(0, Math.floor(bounds.left) - 2), top = Math.max(0, Math.floor(bounds.top) - 2);
    const width = Math.min(mask.width, Math.ceil(bounds.right) + 2) - left, height = Math.min(mask.height, Math.ceil(bounds.bottom) + 2) - top;
    const distances = new Float32Array(width * height);
    let sumX = 0, sumY = 0, count = 0;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const px = left + x, py = top + y;
      if (mask.data[py * mask.stride + (px >>> 5)] & (1 << (px & 31))) { distances[y * width + x] = 1e6; sumX += x; sumY += y; count++; }
    }
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (distances[i]) distances[i] = Math.min(distances[i], distances[i - 1] + 1, distances[i - width] + 1, distances[i - width - 1] + Math.SQRT2, distances[i - width + 1] + Math.SQRT2);
    }
    let best, score = -Infinity;
    for (let y = height - 2; y > 0; y--) for (let x = width - 2; x > 0; x--) {
      const i = y * width + x; if (!distances[i]) continue;
      distances[i] = Math.min(distances[i], distances[i + 1] + 1, distances[i + width] + 1, distances[i + width + 1] + Math.SQRT2, distances[i + width - 1] + Math.SQRT2);
      const value = distances[i] - .01 * Math.hypot(x - sumX / count, y - sumY / count);
      if (value > score) { score = value; best = { x: left + x + .5, y: top + y + .5 }; }
    }
    return best;
  }
  function mapCoverage(mask, rect) {
    let occupied = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = Math.floor(rect.left + (x + .5) * (rect.right - rect.left) / 4), py = Math.floor(rect.top + (y + .5) * (rect.bottom - rect.top) / 4);
      if (mask.rectangle({ left: px, right: px + 1, top: py, bottom: py + 1 })) occupied++;
    }
    return occupied / 16;
  }
  function foreignObstacles(masks, own) {
    const result = new OccupancyBitmap(masks[own].width, masks[own].height);
    for (let id = 0; id < masks.length; id++) if (id !== own) {
      for (let word = 0; word < result.data.length; word++) result.data[word] |= masks[id].data[word];
    }
    return result;
  }
  // Soft outward preference, balanced against squared leader length.
  function outwardCost(rect, origin, centre, distance, strength = 1000) {
    const vx = origin.x - centre.x, vy = origin.y - centre.y;
    const lx = (rect.left + rect.right) / 2 - origin.x, ly = (rect.top + rect.bottom) / 2 - origin.y;
    const alignment = (vx * lx + vy * ly) / (Math.hypot(vx, vy) * Math.hypot(lx, ly) || 1);
    return distance ** 2 + strength * (1 - alignment);
  }
  function verticalCost(rect, origin, localCenterY, strength = 4000) {
    const dy = (rect.top + rect.bottom) / 2 - origin.y;
    const dx = (rect.left + rect.right) / 2 - origin.x;
    const alignment = Math.sign(origin.y - localCenterY) * dy / (Math.hypot(dx, dy) || 1);
    return strength * (1 - alignment);
  }
  // Bounded forward checking proposes alternatives. Final placement still
  // rasterizes each accepted label and leader consecutively.
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const intersects = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < -1e-6 && cross(c, d, a) * cross(c, d, b) < -1e-6;
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  function cuts(a, b, r) {
    let low = 0, high = 1;
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
      if (Math.abs(delta) < 1e-8) { if (start < min || start > max) return false; }
      else { const x = (min - start) / delta, y = (max - start) / delta; low = Math.max(low, Math.min(x, y)); high = Math.min(high, Math.max(x, y)); if (low > high) return false; }
    }
    return true;
  }
  const connectionSegments = candidate => {
    const points = candidate.pixelConnection || [candidate.pixelAnchor, candidate.pixelEnd];
    return points.slice(1).map((point, i) => [points[i], point]);
  };
  function geographicOrderConflict(a, b) {
    if (!a.preserveVerticalOrder || !b.preserveVerticalOrder) return false;
    const sourceDy = a.sourceCenter.y - b.sourceCenter.y;
    const labelDy = (a.rect.top + a.rect.bottom - b.rect.top - b.rect.bottom) / 2;
    return Math.abs(sourceDy) >= 6 && sourceDy * labelDy < -1;
  }
  const connectionConflict = (a, b) => geographicOrderConflict(a, b) || overlaps(a.pixelRect, b.pixelRect)
    || connectionSegments(a).some(([p, q]) => cuts(p, q, b.pixelRect) || connectionSegments(b).some(([r, s]) => intersects(p, q, r, s)))
    || connectionSegments(b).some(([p, q]) => cuts(p, q, a.pixelRect));
  function connected(labels, cityMask, order, scale = 1, budgetMs = 100, leastConstraining = false) {
    let key = 0;
    const options = labels.map(label => label.candidates.filter(candidate => connectionSegments(candidate).every(([a, b]) => !cityMask.line(a, b, scale * .6))).map(candidate => ({ ...candidate, id: label.id, key: key++ })));
    const conflict = new Map(), keyRange = key;
    const scratch = new OccupancyBitmap(cityMask.width, cityMask.height);
    function words(candidate) {
      if (candidate.words) return candidate.words;
      scratch.rectangle(candidate.pixelRect, true);
      connectionSegments(candidate).forEach(([a, b], i) => scratch.line(a, b, scale * .6, true, i ? 0 : ATTACHMENT_PIXELS * scale));
      const touched = new Set();
      for (let i = 0; i < scratch.journal.length; i += 2) touched.add(scratch.journal[i]);
      candidate.words = Uint32Array.from([...touched].sort((a, b) => a - b).flatMap(index => [index, scratch.data[index]]));
      scratch.rollback(0); return candidate.words;
    }
    function pixelOverlap(a, b) {
      const x = words(a), y = words(b); let i = 0, j = 0;
      while (i < x.length && j < y.length) {
        if (x[i] < y[j]) i += 2;
        else if (y[j] < x[i]) j += 2;
        else { if (x[i + 1] & y[j + 1]) return true; i += 2; j += 2; }
      }
      return false;
    }
    function collides(a, b) {
      const key = Math.min(a.key, b.key) * keyRange + Math.max(a.key, b.key);
      if (conflict.has(key)) return conflict.get(key);
      const value = connectionConflict(a, b) || pixelOverlap(a, b);
      conflict.set(key, value); return value;
    }
    const now = () => typeof performance === 'undefined' ? Date.now() : performance.now();
    const started = now(); let visits = 0, stopped = false;
    function visit(domains, placed) {
      if (!domains.length) return placed;
      if (++visits > 20000 || now() - started > budgetMs) { stopped = true; return null; }
      const chosen = domains.reduce((a, b) => a.pool.length <= b.pool.length ? a : b);
      const remaining = domains.filter(domain => domain !== chosen);
      const directions = new Map();
      const sample = leastConstraining ? chosen.pool.filter(candidate => {
        const count = directions.get(candidate.direction) || 0; directions.set(candidate.direction, count + 1); return count < 3;
      }) : chosen.pool;
      const choices = leastConstraining ? sample.map(candidate => {
        const next = remaining.map(domain => ({ id: domain.id, pool: domain.pool.filter(p => !collides(candidate, p)) }));
        return { candidate, next, freedom: next.reduce((sum, domain) => sum + Math.log(domain.pool.length), 0) };
      }).filter(choice => choice.next.every(domain => domain.pool.length)).sort((a, b) => b.freedom - a.freedom || a.candidate.placementCost - b.candidate.placementCost) : chosen.pool.map(candidate => ({ candidate }));
      if (leastConstraining) {
        const included = new Set(sample);
        choices.push(...chosen.pool.filter(candidate => !included.has(candidate)).map(candidate => ({ candidate })));
      }
      for (const choice of choices) {
        const { candidate } = choice;
        const next = choice.next || remaining.map(domain => ({ id: domain.id, pool: domain.pool.filter(p => !collides(candidate, p)) }));
        if (next.some(domain => !domain.pool.length)) continue;
        const result = visit(next, [...placed, candidate]);
        if (result) return result;
        if (stopped) return null;
      }
      return null;
    }
    const placed = visit(order.map(id => ({ id, pool: options[id] })), []) || [];
    // Improve the complete layout, not merely the first feasible packing.
    for (let pass = 0; pass < 2 && placed.length === labels.length; pass++) {
      for (const item of placed.slice().sort((a, b) => (b.placementCost || 0) - (a.placementCost || 0))) {
        for (const candidate of options.find(pool => pool[0]?.id === item.id) || []) {
          if ((candidate.placementCost || 0) >= (item.placementCost || 0)) break;
          if (placed.every(other => other === item || !collides(candidate, other))) { placed[placed.indexOf(item)] = candidate; break; }
        }
      }
    }
    connected.debug = { depth: placed.length, visits, stopped };
    return placed;
  }

  function consecutive(base, cities, labels, order, scale = 1, options = {}) {
    const now = () => typeof performance === 'undefined' ? Date.now() : performance.now();
    const started = now(), maxChecks = options.maxChecks || 6000, maxMs = options.maxMs || 75;
    const occupied = new OccupancyBitmap(base.width, base.height), placed = [];
    let checks = 0, backtracks = 0, stopped = false;
    const pools = labels.map(label => label.candidates.filter(p => !base.rectangle(p.pixelRect) && connectionSegments(p).every(([a, b]) => !cities.line(a, b, scale * .6))));
    const clear = p => {
      if (++checks > maxChecks || (checks % 64 === 0 && now() - started > maxMs)) { stopped = true; return false; }
      return !occupied.rectangle(p.pixelRect) && connectionSegments(p).every(([a, b], i) => !occupied.line(a, b, scale * .6, false, i ? 0 : ATTACHMENT_PIXELS * scale)) && !placed.some(other => connectionConflict(p, other));
    };
    function visit(remaining) {
      if (!remaining.length) return true;
      if (stopped) return false;
      let selected, viable;
      // A capped minimum-remaining-values lookahead detects blocked labels
      // early without fully rescanning every candidate for every label.
      for (const id of remaining) {
        const choices = [];
        for (const p of pools[id]) { if (clear(p)) choices.push(p); if (choices.length === 8 || stopped) break; }
        if (stopped || !choices.length) return false;
        if (!viable || choices.length < viable.length) { selected = id; viable = choices; }
      }
      const rest = remaining.filter(id => id !== selected);
      for (const p of pools[selected]) {
        if (!clear(p)) { if (stopped) return false; continue; }
        const checkpoint = occupied.checkpoint();
        occupied.rectangle(p.pixelRect, true);
        connectionSegments(p).forEach(([a, b], i) => occupied.line(a, b, scale * .6, true, i ? 0 : ATTACHMENT_PIXELS * scale));
        placed.push({ ...p, id: labels[selected].id, leader: [p.anchor, p.end] });
        if (visit(rest)) return true;
        placed.pop(); occupied.rollback(checkpoint); backtracks++;
        if (stopped) return false;
      }
      return false;
    }
    const complete = visit(order);
    return { placed: complete ? placed : [], complete, checks, backtracks, available: pools.map(pool => pool.length), elapsed: now() - started };
  }
  root.SkiLabelLayout = { OccupancyBitmap, greedy, consecutive, connected, outwardCost, verticalCost, foreignObstacles, polygonCenter, mapCoverage, geographicOrderConflict };
})(typeof window === 'undefined' ? globalThis : window);
