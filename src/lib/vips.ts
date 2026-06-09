// Manual VIP overrides. The contact graph already guesses who matters from how
// often you exchange mail and what you star (see contacts.ts `vip`), and the
// Focus view boosts those senders. But "important" is personal — your manager
// who emails rarely, an investor, a key client — so SuperMail lets you pin a
// correspondent as VIP, or explicitly demote a frequent-but-noisy one. These
// overrides ride on top of the heuristic and feed the Focus ranking, the
// reader's sender card and the People view.
//
// Pure and immutable so the logic is testable away from React; persisted as a
// plain `email -> boolean` map (true = forced VIP, false = forced not-VIP).

export type VipMap = Record<string, boolean>;

// One contact = one entry regardless of address casing across messages.
export function normVipEmail(email: string): string {
  return email.trim().toLowerCase();
}

// The explicit override for an address: true (forced VIP), false (forced
// not-VIP), or undefined (no override — defer to the heuristic).
export function vipOverride(map: VipMap, email: string): boolean | undefined {
  const k = normVipEmail(email);
  return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : undefined;
}

// Effective VIP status, blending an explicit override with the heuristic guess.
export function isVip(map: VipMap, email: string, heuristicVip: boolean): boolean {
  const o = vipOverride(map, email);
  return o === undefined ? heuristicVip : o;
}

// Set an explicit override. Returns the same reference when nothing changes so
// React doesn't re-render / re-persist needlessly.
export function setVip(map: VipMap, email: string, vip: boolean): VipMap {
  const k = normVipEmail(email);
  if (!k) return map;
  if (Object.prototype.hasOwnProperty.call(map, k) && map[k] === vip) return map;
  return { ...map, [k]: vip };
}

// Remove an override entirely → the address reverts to the heuristic. Same
// reference when there was nothing to clear.
export function clearVip(map: VipMap, email: string): VipMap {
  const k = normVipEmail(email);
  if (!Object.prototype.hasOwnProperty.call(map, k)) return map;
  const next = { ...map };
  delete next[k];
  return next;
}

// Convenience: cycle a contact's VIP state given the heuristic. If it's
// currently effectively-VIP, force it off; otherwise force it on. (We always
// store an explicit override so the toggle is predictable.)
export function toggleVip(map: VipMap, email: string, heuristicVip: boolean): VipMap {
  return setVip(map, email, !isVip(map, email, heuristicVip));
}

// The full effective VIP address set: start from the heuristic VIPs, then apply
// every explicit override (force-on adds, force-off removes). Used to feed the
// Focus priority engine.
export function vipEmailSet(map: VipMap, heuristicVips: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const e of heuristicVips) set.add(normVipEmail(e));
  for (const [k, v] of Object.entries(map)) {
    if (v) set.add(k);
    else set.delete(k);
  }
  return set;
}

// How many contacts the user has explicitly pinned as VIP (force-on only).
export function manualVipCount(map: VipMap): number {
  return Object.values(map).filter(Boolean).length;
}

// Defensive load: keep only string keys with boolean values.
export function sanitizeVips(raw: unknown): VipMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: VipMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = normVipEmail(k);
    if (key && typeof v === "boolean") out[key] = v;
  }
  return out;
}
