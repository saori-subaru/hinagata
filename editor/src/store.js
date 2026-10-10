// The recipe being edited (fully resolved options), its undo history, and the characters saved in this browser.
import { DEFAULTS, SCHEMA, resolveOptions, diff, openRecipe, RECIPE_VERSION } from "hinagata/index.js";

export const PATHS = Object.keys(SCHEMA);
export const getPath = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);
export function setPath(o, path, v) { const ks = path.split("."); let x = o; for (const k of ks.slice(0, -1)) x = x[k] ??= {}; x[ks.at(-1)] = v; }
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
/** Paths (schema leaves) whose values differ between two recipes */
export const changedPaths = (a, b) => PATHS.filter((p) => !same(getPath(a, p), getPath(b, p)));
/** How many values differ from the defaults (optionally only paths starting with one of `prefixes`) */
export const diffCount = (r, keep = () => true) => PATHS.filter((p) => keep(p) && !same(getPath(r, p), getPath(DEFAULTS, p))).length;
export const isDefault = (r, p) => same(getPath(r, p), getPath(DEFAULTS, p));
export const recipeOf = (user) => resolveOptions(user ?? {});
/** A recipe from outside (a character file, a link, a sync file; bare = the version of one without a version) → { recipe (resolved), name } */
export const recipeIn = (input, bare = 1) => { const o = openRecipe(input, { bare }); return { recipe: recipeOf(o.options), name: o.name, version: o.version }; };
export const compact = (r) => diff(DEFAULTS, r);

/**
 * The recipe and its history. A gesture (dragging a slider) changes values live with set(); commit() closes it as one undo step.
 * listeners get (paths, why): why = "set" | "commit" | "undo" | "redo" | "replace".
 */
export function createStore(recipe) {
  let cur = structuredClone(recipe), before = null;
  const past = [], future = [], fns = new Set(), LIMIT = 150;
  const emit = (paths, why) => { for (const f of fns) f(paths, why); };
  const S = {
    get recipe() { return cur; },
    get canUndo() { return past.length > 0 || !!before; },
    get canRedo() { return future.length > 0; },
    get: (p) => getPath(cur, p),
    subscribe(fn) { fns.add(fn); return () => fns.delete(fn); },
    /** change values (live). changes: { path: value } */
    set(changes, { commit = false } = {}) {
      before ??= structuredClone(cur);
      for (const [p, v] of Object.entries(changes)) setPath(cur, p, v);
      emit(Object.keys(changes), "set");
      if (commit) S.commit();
    },
    /** close the current gesture as one undo step (nothing if the values came back to where they were) */
    commit() {
      if (!before) return;
      const paths = changedPaths(before, cur);
      if (paths.length) { past.push(before); if (past.length > LIMIT) past.shift(); future.length = 0; }
      before = null; emit(paths, "commit");
    },
    undo() { S.commit(); if (!past.length) return; const prev = past.pop(), paths = changedPaths(cur, prev); future.push(cur); cur = prev; emit(paths, "undo"); },
    redo() { S.commit(); if (!future.length) return; const next = future.pop(), paths = changedPaths(cur, next); past.push(cur); cur = next; emit(paths, "redo"); },
    /** a different character: new recipe, history cleared */
    replace(recipe) { before = null; past.length = future.length = 0; const paths = changedPaths(cur, recipe); cur = structuredClone(recipe); emit(paths, "replace"); },
  };
  return S;
}

// ── characters saved in this browser: { v, current, chars: [{ id, name, updated, recipe (only what differs) }] } ──
// v: the recipe version the recipes are written in (src/options.js). A library of an older version (v 1: the chibi defaults, before
// 2026-10-06; v 2: the first tall body, about 4 heads) is brought up to today's once, on loading: each recipe gets the old defaults it was made against, so every character
// stays as it was (and is saved that way on the next save).
const KEY = "hinagata.editor.library";
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export function loadLibrary() {
  try { const L = JSON.parse(localStorage.getItem(KEY)); if (L && Array.isArray(L.chars)) {
    const v = Number.isInteger(L.v) ? L.v : 1;
    if (v < RECIPE_VERSION) { for (const c of L.chars) c.recipe = compact(recipeIn({ hinagata: v, options: c.recipe ?? {} }).recipe); L.v = RECIPE_VERSION; }
    return L; } } catch {}
  return { v: RECIPE_VERSION, current: null, chars: [] };
}
/** returns false when the browser refused to store it (full or blocked) */
export function saveLibrary(L) { try { localStorage.setItem(KEY, JSON.stringify(L)); return true; } catch { return false; } }
export function addChar(L, name, recipe) { const c = { id: newId(), name, updated: Date.now(), recipe: compact(recipe) }; L.chars.unshift(c); L.current = c.id; return c; }
