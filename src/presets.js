// Ready-made characters (2026-10-06, Saori made them in the editor): character files, version 3 (the tall defaults with a head of 0.7: they keep it under version 4's 0.64).
// In a game: createAvatar(CHARACTERS.sylvie.file). In the editor: the character list → 「プリセットから作る」.
// Add one: make it in the editor, Export → JSON (or copy the code), and put its options here with the version it was made in.
// シルヴィ's prints (PNG drawn from shapes): the dress's front (straps, belts with buckles, clovers; texture mode "front", 0.5 m square)
// and the cape's border along its hem (stepped motifs; mode "hem", half the turn round her per picture)
const SYLVIE_DRESS = "data:image/png;base64,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";
const SYLVIE_CAPE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAyAAAAHgBAMAAACvKRTGAAAAGFBMVEUAAAC2zr7v6NwAAAAAAAAAAAAAAAAAAACR7jRnAAAACHRSTlMA//8AAAAAAMEVs10AAAFzSURBVHja7djRDYIwFAXQShxAnMC4/0zGDcoE4k/howRKm6iYnPMDBNoHXCB5hAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMB/OWXb3S2txLQch8oZ+2ngNa28ntsD7nmlWHsNl6z0xyvOlebSj+3j99/WzjN5LAIRCAIRCAIRCAIRCL/u1Be96CzubJdDa4tfPUPtKZYrlmZYVGz+j7Fa0Rvik4VABIJABIJABIJABMKRnNd2TC398vdCQWw9lXEa2dcOHL5dsf0ii7fVG+KThUAEgkAEgkAEgkAAAAAAAAAAAAAAAACo8Qb7VCYKlQtZsAAAAABJRU5ErkJggg==";
export const CHARACTERS = {
  sylvie: {
    name: { ja: "シルヴィ", en: "Sylvie" },
    about: { ja: "エルフの女の子", en: "An elf girl" },
    file: { hinagata: 3, name: "シルヴィ", options: {
      colors: { skin: "#fff0ea", hair: "#fff7f0", eyes: "#41714d" },
      body: {
        proportion: { legs: 1.65, torso: 1.3, arms: 1.45 },   // arms: made when the tall default was 1.45
        head: { scale: 0.69, depth: 0.92 },
        torso: { chest: 0.92, belly: 0.6, waist: 0.026, hips: 0.92, bust: 0.77, butt: 0.96, back: 0.56 },
        thickness: { upperArm: 0.77, forearm: 0.74, thigh: 0.6, thighTop: 0.61, calf: 0.6 },
        knees: { blush: { on: true }, line: { on: true } },   // pink knees with the kneecap's line, as on her sheet
        sculpt: {
          neck: { width: 0.75 },
          cheeks: { y: 0.94, height: 0.14 },
          chin: { k: 0.024, sharp: 0.1 },
          cheekTrim: { depth: 0 },
          cheekFill: { depth: 0.004 },
          ears: { elf: { on: true, length: 0.255, width: 0.05, angle: -20 } },
        },
      },
      outfit: {   // (2026-11-17, from Saori's design sheet: a hooded capelet closed with two buttons, cuffs, a petticoat, strapped boots)
        shirt: { on: false, sleeve: "bell", bell: 0.04, underarm: "loose", cuffColor: "#66907d", cuffLine: "#efe8dc", cuffWidth: 0.03, collar: { notch: 0.036, notchWidth: 0.026 } },
        cape: { on: true, color: "#66907d", hem: 0.53, flare: 0.45, sway: 0.25, front: "closed", close: 0.715, open: 0.5, tilt: 0.25, hood: true, hoodRim: false, neckOpen: 0.07, line: "#efe8dc",
          texture: { src: SYLVIE_CAPE, mode: "hem", scale: 0.47 } },
        dress: { gradient: { color: "#d5e3d7", start: 0.7, soft: 0.5 }, on: true, color: "#ffffff", waist: 0.63, hem: 0.37, flare: 0.55, pleats: 0, under: 0.05, underColor: "#55776b", underPleats: 20,
          sideDrop: 0.035, sideAt: 0.6, sideOut: 0.01, middleBack: false, cinch: 0.012, cinchAt: 0.53, tabDrop: 0.0312, tabAt: 0.115, tabWidth: 0.056,
          texture: { src: SYLVIE_DRESS, mode: "front", scale: 0.5, y: 0.72 } },
        pants: { on: false, kind: "skirt" },
        armor: { helm: "close", deco: "plume" },
        weapon: { shieldMount: "straight" },
        shoes: { kind: "boots", color: "#66907d", sole: 0.035, straps: 2, strapAt: 0.028, strapWidth: 0.009, strapGap: 0.009, notch: 0.012, notchWidth: 0.044 },
      },
      accessories: [   // the collar: two buttons with an X at the hood's rim's ends, a cord between them, a tab hanging under each with a tassel (offsets from upperChest, as built)
        { kind: "tab", bone: "upperChest", at: [0.041, 0.02, 0.153], n: [-0.15, 0.2, 0.97], size: 0.075, color: "#a3bbac", mirror: true },   // along the cape (it comes forward under the button)
        { kind: "tassel", bone: "upperChest", at: [0.039, -0.0518, 0.1676], n: [0, 0, 1], size: 0.045, color: "#efe8dc", mirror: true },   // from the tab's end
        { kind: "cord", bone: "upperChest", at: [0, 0.0264, 0.149], n: [0, 0, 1], size: 0.08, color: "#efe8dc", lift: 0.003 },
        { kind: "button", bone: "upperChest", at: [0.041, 0.0264, 0.149], n: [-0.12, 0.32, 0.94], size: 0.054, color: "#efe8dc", mirror: true, lift: 0.002 },
        { kind: "cross", bone: "upperChest", at: [0.041, 0.0264, 0.149], n: [-0.12, 0.32, 0.94], size: 0.034, color: "#66907d", mirror: true, lift: 0.0138 },
      ],
      hair: {
        tail: { kind: "side", y: 1.18, count: 4, width: 0.07, spread: 1.0, waves: 0.5, tiers: 3, tierFlick: 0.025, tie: { size: 1.6 } },   // the tie as big and as high as on her design sheet (measured against the eyes)
        rigid: 0.5, lockPoints: 5,
        paint: { inner: 0.3 },
        // the sidelocks: from under the bangs' edge straight down along the cheeks, curving in a little under the jaw (her design sheet; head space).
        // Rooted further back, they came out from under the side locks' hem and looked cut off. stiff 1: a run blew them back level with the ears
        drawn: [{ pts: [[0.12, 1.11, 0.14], [0.15, 1.03, 0.13], [0.172, 0.94, 0.115], [0.17, 0.85, 0.115], [0.153, 0.77, 0.13]], width: 0.028, thick: 0.35, stiff: 3, mirror: true }],
        sculpt: {
          shortBack: 0.78,   // the back's hem at the middle, longer only there (shortLocks.below lengthened every lock: long strands beside the face, whiskers at the ears)
          nendo: {
            tips: [
              [-81.52, 0.887, 0.69, 0.33, null, 6],
              [-59.948, 0.918, 0.5, 0, null, 5.5],
              [-41.804, 1.002],
              [-43.334, 0.923],
              [7.098, 0.99, 0.8, 0.04, "c", 0, 0, 0, 0.9],
              [36.781, 1.002, 0.8, 0, "c"],
              [46.958, 0.943],
              [54.716, 0.919],
              [42.444, 0.898, 0.5, 0, null, -3.5],
              [84, 0.87, 0.66, -0.33, null, -12.5],
            ],
            overlap: 1.44,
          },
          shortLocks: {
            count: 12, width: 0.09, thick: 0.1, below: 0.03, flick: 0.01, hug: 0.95, innerHug: 0.82,
            // the left side mirrors the right. 1 and 10 hang over the elf ears and stop there (a lock passes through an ear: a long one buried
            // the ear's root in hair); 0 and 11, before the ears, reach the chin. A flick on them (fl 0.02) stuck out over the ears as spikes.
            // Behind the ears (2, 9 and the inner 13, 14, 20, 21) longer and flicked out: the sides flare at the jaw while the nape hugs (her design sheet)
            edits: [
              { i: 0, dy: -0.0922, da: 0.46 },
              { i: 1, dy: -0.01, da: -3.67 },
              { i: 2, dy: -0.03, da: -5.05, fl: 0.012 },
              { i: 9, dy: -0.03, da: 5.05, fl: 0.012 },
              { i: 10, dy: -0.01, da: 3.67 },
              { i: 11, dy: -0.0922, da: -0.46 },
              { i: 13, dy: -0.012, fl: 0.012 },
              { i: 14, dy: -0.001, fl: 0.012 },
              { i: 20, dy: -0.001, fl: 0.012 },
              { i: 21, dy: -0.012, fl: 0.012 },
              { i: 26, dy: 0.0251, da: 11.34 },
              { i: 27, dy: 0.012, da: -15.16 },
            ],
            stiff: 2.7,
          },
          long: { flick: 0.002, bottom: 0.85 },
        },
      },
      face: {
        blush: { cheeks: { on: true }, nose: { on: true } },
        parts: { mouth: "image" },
        expressions: { happy: { eyes: "happy", brows: "normal", mouth: "openSoft", cheeks: "none" } },   // 笑う口は絵を用意するまでコードの openSoft
        layout: { eyeX: 0.088 },
        drawn: [{ id: "e1", name: "表情1", eye: null, brow: null, mouth: null, cheeks: "none", blink: true }],
      },
    } },
  },
  astel: {
    name: { ja: "アステル", en: "Astel" },
    about: { ja: "勇者っぽい男の子", en: "A hero boy" },
    // 2026-10-06 Saori remade him as a boy (both presets were girls): the tall default body (legs 1.76, torso 1.13, arms 1.17)
    file: { hinagata: 3, name: "アステル", options: {
      colors: { skin: "#fee5d2", hair: "#906b47" },
      body: {
        head: { width: 0.94 },
        sculpt: { neck: { width: 0.8 }, mouth: { profile: 2 } },   // profile: a dip under the nose seen from the side (2026-10-07, Saori: "アステルの顔をこれにするといいかも")
      },
      outfit: {
        shirt: { color: "#83a8d8", gradient: { color: "#febebe" }, sleeve: "long" },
        cape: { on: true },
        dress: { gradient: { on: true, color: "#c8f9f8", start: 0.66, soft: 0.35 } },
        pants: { length: "knee" },
        armor: { on: true },
        weapon: { right: "sword", left: "shield" },
        shoes: { kind: "boots", bootHeight: 0.135 },
        socks: { on: false },
      },
      hair: {
        gradient: { on: true, color: "#eec9a0" },
        paint: { ring: { shade: 0.5 } },   // 🚧 trying the look out on him
        tail: { kind: "pony", y: 0.95, length: 0.62, lift: 0.1, size: 0.5, wave: 0.016, tie: { on: false } },
        ahoge: false,
        sculpt: {
          nendo: { puff: 0.011 },
          shortLocks: { below: 0.12, flick: -0.026 },
          long: { count: 16, bottom: 0.725 },
        },
      },
      face: { parts: { eyes: "image", brows: "image", mouth: "image" }, lashTrace: 0.8 },
      outline: { trace: 0.75 },
    } },
  },
  lumina: {
    name: { ja: "ルミナ", en: "Lumina" },
    about: { ja: "ツインテールの美少女", en: "A pretty girl with twin tails" },
    // 2026-10-07, Claude (Saori: "超絶美少女を作ってください"): lavender twin tails with bows, the sparkly eyes, a white dress fading to
    // lavender, over-the-knee socks. Made with the parts added for her: eyes "sparkle", the "ribbon" accessory, socks above the knee
    file: { hinagata: 3, name: "ルミナ", options: {
      colors: { skin: "#fff1e8", hair: "#efe4f7", eyes: "#6d4fd0" },
      body: {
        proportion: { legs: 1.82, torso: 1.13, arms: 1.17, hands: 1.05, shoulders: 0.94 },
        head: { scale: 0.68, jawLength: 1.4 },   // a longer jaw under the mouth, so the chin can come to a point (Saori)
        torso: { chest: 0.9, belly: 0.6, waist: 0.06, hips: 0.8, bust: 0.8, butt: 0.96, back: 0.56 },
        thickness: { upperArm: 0.72, forearm: 0.68, thigh: 0.62, thighTop: 0.78, calf: 0.6 },
        // legs that close in (2026-10-07, Saori, with a Genshin model beside her: the legs stood apart at the hips' width and the tops of the
        // thighs jutted out under the waist): hip joints in, knees and ankles further in, the thighs' round tops lowered (topDrop). A long, strong
        // waist (Eva-like; the skirt was fixed to come out of it smoothly). legShape 1.5: knees and calves
        joints: { hipX: 0.09, kneeX: 0.05, footX: 0.05 },
        // full cheeks (Saori: "ほおがこけて、りんかくが角ばって"): not trimmed at the side, filled out and longer; a pointed chin (sharpness, not
        // the V chin: that left a corner under the ear). The later tries (a wider face, smaller eyes and sockets) kept the chin round, so she is
        // this face, the one Saori picked ("いったんこの時のルミナを")
        sculpt: { neck: { width: 0.72 }, waist: { height: 0.12, blend: 0.07 }, thigh: { topDrop: 0.06 }, legShape: 1.5, cheeks: { y: 0.94, height: 0.14 }, cheekTrim: { depth: 0 }, cheekFill: { depth: 0.007 }, chin: { k: 0.024, sharp: 0.3 } },
      },
      hair: {
        back: "long",
        gradient: { on: true, color: "#b48ae8", start: 0.45, soft: 0.55 },
        tail: { kind: "twin", y: 1.1, length: 0.6, size: 1.1, wave: 0.018, waves: 2.2, tie: { on: false } },
        paint: { ring: { strength: 0.6, color: "#ffffff" } },
        sculpt: {
          long: { bottom: 0.85, count: 18 },
          nendo: {   // the default tips, the middle ones raised off the eyes
            tips: [[-81.52, 0.887, 0.69, 0.33, null, 6], [-56.458, 0.95, 0.5, 0, null, 5.5], [-42, 1.07], [-36.124, 1.03], [5.627, 1.05, 0.8, 0.04, "c"], [13.563, 1.05, 0.8, 0, "c"], [27.929, 1.035], [41.397, 1.0], [59.583, 0.95, 0.5, 0, null, -3.5], [84, 0.87, 0.66, -0.33, null, -12.5]],
          },
        },
      },
      face: { eyeSize: 1.35, parts: { eyes: "sparkle" }, blush: { cheeks: { on: true, strength: 0.35 } } },
      outfit: {
        shirt: { on: false },
        pants: { on: false },
        dress: { on: true, color: "#ffffff", waist: 0.5, hem: 0.3, flare: 0.62, curl: 0.15, hemShape: "scallop", gradient: { on: true, color: "#cbb7f2", start: 0.6, soft: 0.5 } },
        socks: { color: "#3b3352", top: 0.28 },
        shoes: { kind: "heels", color: "#3a2f52" },
      },
      accessories: [
        { kind: "ribbon", bone: "head", at: [0.25, 1.25, 0.05], n: [0.5, 0.6, 0.62], spin: -12, size: 0.17, color: "#7a5cc8", mirror: true },   // over the tails' ties
        { kind: "ribbon", bone: "spine", at: [0, 0.02, -0.128], n: [0, 0.1, -1], size: 0.17, color: "#7a5cc8" },   // at the back of the waist
        { kind: "ribbon", bone: "upperChest", at: [0, 0.035, 0.142], n: [0, 0.15, 1], size: 0.075, color: "#7a5cc8" },
        { kind: "band", bone: "neck", at: [0, 0.046, 0.072], size: 0.012, color: "#3b3352" },   // a choker, above the collar
      ],
      shading: { style: "soft", rim: { on: true, color: "#fff0ff", strength: 0.5 } },
    } },
  },
};
// シルヴィ v2: シルヴィ with the head, ears, hair and face of her design sheet (the first one stays as it was made)
{ const o = structuredClone(CHARACTERS.sylvie.file.options);
  // hair a shade darker than her skin, as on her design sheet (as pale as the skin, the forehead between the bangs and the hair over it read as
  // one bare patch), and the ring a light highlight (the automatic ring is never lighter than 0.85: on pale hair a skin-colored band across the bangs)
  o.colors.hair = "#f4ece3";
  o.outline = { trace: 0.75 };
  o.body.head.crown = 1.2;   // the top of the head as high over the eyes as on her design sheet (higher, 1.35, came out flat-topped and stepped)
  o.body.sculpt.crown = { y: 1.34, blend: 0.14 };
  o.body.sculpt.cheeks = { ...o.body.sculpt.cheeks, y: 0.96, height: 0.1 };   // the cheeks fullest higher, not down to the jaw: from 3/4 the jowls (v1's 0.94 / 0.14) bulged out past the chin   // the flat top's corner rounded wide: the head's outline one curve (blend 0.05 left a flat top with a corner each side)
  o.body.sculpt.hand = { slim: 1, fingers: 0.7 };   // her sheet's hands: slender, tapering, the fingers together (fingers 0.7: a child's, not the adult hand's 0.55)
  // her sheet's neck: a thin column, the shirt's neckline and the cape close round its base (lower and wider they bared the slope to the shoulders,
  // and the neck read as wide as that)
  o.body.sculpt.neck = { ...o.body.sculpt.neck, width: 0.6 }; Object.assign(o.outfit.shirt.collar, { y: 0.786, bowl: 4 }); o.outfit.cape.neckOpen = 0.05;
  o.body.sculpt.ears = { elf: { on: true, length: 0.12, width: 0.045, angle: -14, back: 30, curve: 0, round: 0.3 } };   // short, level and a little back: their tips show beside the hair
  Object.assign(o, {
      hair: {
        // the tail as on her design sheet: tied high and behind the ear, hanging close to the head as a few thick locks whose tips fan out,
        // with its own outline over the other hair (without it, the same color, it read as part of the head)
        tail: { kind: "side", y: 1.24, angle: 116, count: 4, width: 0.07, thick: 0.75, volume: 0.025, lift: 0.025, spread: 1.0, gather: 0.5, waves: 0.5, tiers: 2, tierFlick: 0.012, flare: 0.085, outline: true, tie: { size: 1.6, kind: "berries" } },
        rigid: 0.5, lockPoints: 5,
        paint: { inner: 0.3, oneShade: 1, ring: { color: "#fffaf4", shade: 0.35 } },   // one shadow over the hair, its edge smooth (lock by lock it was stepped and patchy on her pale hair)
        // the sidelocks: rooted at the temple's hairline under the cap (rooted under the bangs' edge they read as growing from the eyes),
        // straight down along the cheeks, curving in a little under the jaw (head space)
        // (v2: from the whorl under the bangs, out from under them by the temple: rooted at the temple it showed its root's stub above the ear)
        drawn: [{ pts: [[0.17, 1.03, 0.118], [0.175, 0.94, 0.112], [0.17, 0.85, 0.115], [0.153, 0.77, 0.13]], width: 0.028, thick: 0.35, stiff: 3, mirror: true, fromWhorl: true }],
        sculpt: {
          // every lock from the whorl behind the ahoge, laid like roof tiles away from the part down the middle; no block under them (the
          // locks make the head's shape; on a 1.6 cm block they lay over a helmet). lockShell: the locks lie on the skull, not 1.6 cm over it
          whorl: { on: true, th: 180, ph: 78 }, lockShell: 0.004,
          ahogeCurl: true, ahogeSize: 1.05,   // small and curled round as on her design sheet
          shortBack: 0.78,   // the back's hem at the middle, longer only there (shortLocks.below lengthened every lock: long strands beside the face, whiskers at the ears)
          // the bangs as on her design sheet, placed by her eyes (the locks' edges read off its front view, scaled to her eyes' spacing):
          // bands cut aslant to a point (lockBand), each from its own place on the head (lockRootSpread 1: their edges follow the head's
          // round, not lines from the crown), rooted under the cap's hairline (lockRoot). lockSpan 14: the middle blade stays one lock.
          // Rows: [angle, tip height, , , group, sweep, thickness, flick, width, wave, lean]
          nendo: {
            tips: [
              [-81.52, 0.887, 0.69, 0.33, null, 6],
              [-59.948, 0.918, 0.5, 0, null, 5.5],
              [-54, 0.9215, null, null, null, -9.9, 0, 0, 0.58, 0, -0.5],   // outside the eye, hooking in to the cheek
              [-25.6, 1.031, null, null, null, 7, 0.002, 0, 0.32],   // over the eye: a narrow lock flowing out, to the lash
              [-0.4, 1.007, null, null, null, 4.4, -0.004, 0, 0.42, 0, -0.67],   // under the middle one, its point showing below it
              [11.35, 1.004, 0.8, 0.04, "c", 0, 0.004, 0, 1.38, 0, -0.75],   // the middle: a wide blade, its point beside the far eye's inner corner
              [26.1, 1.023, 0.8, 0, "c", -6.6, 0, 0, 0.66, 0, -1],   // from the middle one's edge out over the eye, reaching in under that edge (narrower, 0.35, the forehead showed beside the blade from her left)
              [40.6, 1.008, null, null, null, -10, 0.002, 0, 0.56, 0, -0.7],
              [56, 0.91, 0.5, 0, null, 16.2, 0, 0, 0.57, 0, 0.5],   // outside the eye, hooking in to the cheek
              [84, 0.87, 0.66, -0.33, null, -12.5],
            ],
            overlap: 1.44, lockBand: 0.5, lockRootSpread: 1, lockRoot: 48, lockSpan: 14,
          },
          shortLocks: {
            count: 13, width: 0.09, thick: 0.15, below: 0.03,   // from the whorl (hair.sculpt.whorl): one lock right behind, across from the part
            // the wing on her right (the tail is on her left): the two locks behind the ear flick out from below the head's widest part, their
            // points turning up (drawn cones standing out from behind the ear read as horns)
            // the rest flick out unevenly (as her sheet's hem: tips each its own way), a little longer or shorter by turns
            edits: [{ i: 0, fl: 0.014 }, { i: 1, fl: 0.022, dy: -0.015 }, { i: 2, fl: 0.008, dy: 0.01 }, { i: 3, fl: 0.018 }, { i: 4, fl: 0.01, dy: -0.015 }, { i: 5, fl: 0.02, dy: 0.01 },
              { i: 6, fl: 0.012 }, { i: 7, fl: 0.02, dy: -0.015 }, { i: 8, fl: 0.009, dy: 0.01 }, { i: 9, fl: 0.018, w: 1.25 }, { i: 10, fl: 0.022, w: 1.25, dy: 0.02 },
              { i: 11, fl: 0.016, dy: 0.01 }, { i: 12, fl: 0.021 }],
            stiff: 2.7,
          },
          long: { flick: 0.002, bottom: 0.85 },
        },
      },
      face: {   // as on her design sheet: tall flat-colored eyes set wide, a faint brow, a tiny mouth, a soft blush under the eyes
        blush: { cheeks: { on: true, color: "#ff9a8a", strength: 0.17, size: 0.055, x: 0.135, y: 0.945, hatch: 9 }, nose: { on: false } },
        parts: { eyes: "tall", brows: "thin", mouth: "small", nose: "dot" },
        noseColor: "#c98a8090", noseSize: 0.65, openSize: 1.3, mouth3d: { on: true }, lashHatch: true, lashTrace: 0.8,   // the knees' line's color (body.knees.line), see-through; a small dot
        browsOverHair: true,   // her brows are a whole eye over the eyes (past the face picture's top), drawn over the bangs
        eyeSize: 1.08,   // ⛔ the eyes' size and place are Saori's choice (bigger and further apart than the sheet's on this face): the brows and the bangs are placed by them
        layout: { eyeX: 0.104, eyeY: 1.005, browX: 0.117, browY: 1.15, mouthY: 0.906 },
        // her own expressions: setFace("sad") … keep her eyes and brows (the stock ones swap in the round eyes)
        expressions: {
          happy: { eyes: "tallHappy", brows: "thin", mouth: "openSoft", cheeks: "none" },
          sad: { eyes: "tall", brows: "worried", mouth: "small", cheeks: "none" },
          angry: { eyes: "tall", brows: "angry", mouth: "small", cheeks: "none" },
          surprised: { eyes: "tall", brows: "thin", mouth: "o", cheeks: "none" },
        },
        drawn: [{ id: "e1", name: "表情1", eye: null, brow: null, mouth: null, cheeks: "none", blink: true }],
      },
  });
  CHARACTERS.sylvie2 = { name: { ja: "シルヴィ v2", en: "Sylvie v2" }, about: { ja: "設定画に寄せたシルヴィ", en: "Sylvie as on her design sheet" }, file: { hinagata: 3, name: "シルヴィ v2", options: o } }; }
// シルヴィ v2's back: its outline set first (shortLocks.shape) and the locks laid on it, not an inner layer under flicks lock by lock
{ const o = CHARACTERS.sylvie2.file.options, SL = o.hair.sculpt.shortLocks;
  SL.shape = { hang: 0.75, flare: [[1.0, 0], [0.9, 0.005], [0.8, 0.02], [0.74, 0.032]], sides: 0.7 };   // (hang 0.4 tucked the hem in to the nape: no flick showed)
  // the hem jagged by turns (her sheet's) and the tips flicked out unevenly over the shape (v2's flicks), the two behind her right ear the wing
  const FL = [0.014, 0.022, 0.008, 0.018, 0.01, 0.02, 0.012, 0.02, 0.009, 0, 0, 0.016, 0.021], DY = [0, -0.03, 0.02, -0.01, 0.025, -0.03, 0, -0.025, 0.02, 0, 0, -0.02, 0.015];
  SL.edits = FL.map((fl, i) => i === 9 || i === 10 ? { ...SL.edits.find((e) => e.i === i), fk: 0 } : { i, fl, dy: DY[i] });
  SL.fork = { n: 3, short: 1 };   // each tip split in two points: her sheet's many short tips at the hem, without more locks (layers under them muddied the outline)
}// シルヴィ v2 殻 (a try beside v2): the locks over the head as one shell, as a hand-made model's top is one sheet from the whorl with the
// locks only as lines on it: each lock full width from its root (no narrow root), none tilted over its neighbour, none puffed up off the skull;
// they part only toward their tips
{ const o = structuredClone(CHARACTERS.sylvie2.file.options);
  Object.assign(o.hair.sculpt.whorl, { rootW: 1, shingle: 0, puff: 0 }); o.hair.sculpt.shortLocks.overlap = 1.6;   // overlap: no gap where they lie side by side
  CHARACTERS.sylvie2h = { name: { ja: "シルヴィ v2 殻", en: "Sylvie v2 (shell)" }, about: { ja: "頭の上の房をひとつの殻のようにつなげたシルヴィ v2(試し)", en: "Sylvie v2 with the locks over the head joined as one shell (a try)" }, file: { hinagata: 3, name: "シルヴィ v2 殻", options: o } }; }


// ルミナ v2 (2026-10-09, Saori: "ルミナv2をさっき作ったルミナに置き換えて"; until then ルミナ with a longer face in straight lines): ルミナ at about
// 6 heads on the adult body (body.adult), made 2026-10-08/09 beside a Genshin character's picture and her three views, then Saori's VRoid
// body (DESIGN.md "A 6-head body"): a smaller head, longer torso and legs, the adult torso, legs, hands and feet; a smaller, higher, closer
// pair of eyes, a narrower head, the nose a little forward and a dip under the lower lip in profile; toon shading (with soft and a rim
// light her nose looked flat in profile). Clothes and hair are ルミナ's own (their heights follow the adult body: adultFit)
{ const o = structuredClone(CHARACTERS.lumina.file.options), b = o.body;
  Object.assign(b.head, { scale: 0.48, width: 0.92, jawLength: 1.1 });
  Object.assign(b.proportion, { legs: 2.2, torso: 2.0, chest: 0, shoulders: 0.827, feet: 1.08, arms: 1.4 });   // (arms 1.4: Saori, "手が短すぎる")
  Object.assign(b.joints, { hipY: 0.52, hipX: 0.07, kneeX: 0.072, footX: 0.07 });
  Object.assign(b.torso, { chest: 0.63, hips: 0.56, bust: 0.75, back: 0.392, butt: 0.672 });
  Object.assign(b.thickness, { upperArm: 0.62, forearm: 0.58, thigh: 0.434, thighTop: 0.546, calf: 0.42 });
  b.sculpt.neck = { ...b.sculpt.neck, width: 0.612 }; b.sculpt.bustX = 0.038;
  b.sculpt.chin = { ...b.sculpt.chin, sharp: 0.1, backRise: 1.2, backMax: 0.1 };
  b.sculpt.nose = { ...(b.sculpt.nose ?? {}), tipZ: 0.28 };
  b.sculpt.mouth = { ...(b.sculpt.mouth ?? {}), back: 0, cheekBack: 0.02, underLip: 0.005 };
  b.adult = { on: true };
  o.face = { ...o.face, eyeSize: 1.1, layout: { ...(o.face.layout ?? {}), eyeY: 1.02, browY: 1.108, eyeX: 0.088, browX: 0.082 } };
  o.outfit.dress = { ...o.outfit.dress, waist: 0.54 };   // (Saori: "ワンピースのスカートの位置が下過ぎる"; 0.46 was lower than Lumina's 0.5)
  o.shading = { ...(o.shading ?? {}), style: "toon", rim: { on: false } };
  CHARACTERS.lumina2 = { name: { ja: "ルミナ v2", en: "Lumina v2" }, about: { ja: "6頭身・大人の体のルミナ", en: "Lumina at about 6 heads, on the adult body" }, file: { hinagata: 3, name: "ルミナ v2", options: o } }; }
