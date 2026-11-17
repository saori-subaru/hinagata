// Ready-made characters (2026-10-06, Saori made them in the editor): character files, version 3 (the tall defaults with a head of 0.7: they keep it under version 4's 0.64).
// In a game: createAvatar(CHARACTERS.sylvie.file). In the editor: the character list → 「プリセットから作る」.
// Add one: make it in the editor, Export → JSON (or copy the code), and put its options here with the version it was made in.
// シルヴィ's prints (PNG drawn from shapes): the dress's front (straps, belts with buckles, clovers; texture mode "front", 0.6 m square)
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
        shirt: { on: false, sleeve: "bell", bell: 0.04, underarm: "loose", cuffColor: "#66907d", cuffLine: "#efe8dc", cuffWidth: 0.03 },
        cape: { on: true, color: "#66907d", hem: 0.53, flare: 0.45, sway: 0.25, front: "closed", close: 0.715, open: 0.5, tilt: 0.25, hood: true, line: "#efe8dc",
          texture: { src: SYLVIE_CAPE, mode: "hem", scale: 0.47 } },
        dress: { gradient: { color: "#d5e3d7", start: 0.7, soft: 0.5 }, on: true, color: "#ffffff", waist: 0.63, hem: 0.31, pleats: 0, under: 0.025, underColor: "#55776b", underPleats: 20,
          sideDrop: 0.03, sideAt: 0.45, sideOut: 0.01,
          texture: { src: SYLVIE_DRESS, mode: "front", scale: 0.6, y: 0.66 } },
        pants: { on: false, kind: "skirt" },
        armor: { helm: "close", deco: "plume" },
        weapon: { shieldMount: "straight" },
        shoes: { kind: "boots", color: "#66907d", sole: 0.035, straps: 2, strapAt: 0.028, strapWidth: 0.009, strapGap: 0.009 },
      },
      accessories: [   // the collar: two buttons with an X at the hood's rim's ends, a cord between them, a tab hanging under each with a tassel (offsets from upperChest, as built)
        { kind: "tab", bone: "upperChest", at: [0.041, 0.02, 0.149], n: [0, 0, 1], size: 0.075, color: "#a3bbac", mirror: true },
        { kind: "tassel", bone: "upperChest", at: [0.041, -0.052, 0.15], n: [0, 0, 1], size: 0.045, color: "#efe8dc", mirror: true },
        { kind: "cord", bone: "upperChest", at: [0, 0.0264, 0.149], n: [0, 0, 1], size: 0.08, color: "#efe8dc", lift: 0.003 },
        { kind: "button", bone: "upperChest", at: [0.041, 0.0264, 0.149], n: [-0.12, 0.32, 0.94], size: 0.046, color: "#efe8dc", mirror: true, lift: 0.002 },
        { kind: "cross", bone: "upperChest", at: [0.041, 0.0264, 0.149], n: [-0.12, 0.32, 0.94], size: 0.029, color: "#66907d", mirror: true, lift: 0.0125 },
      ],
      hair: {
        tail: { kind: "side", y: 1.22, waves: 0.5, tie: { size: 2.2 } },
        sculpt: {
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
            count: 12, width: 0.09, thick: 0.1, below: 0.03, flick: 0.01,
            edits: [
              { i: 9, dy: -0.0372, da: 5.05 },
              { i: 26, dy: 0.0251, da: 11.34 },
              { i: 27, dy: 0.012, da: -15.16 },
              { i: 11, dy: -0.0522, da: -0.46 },
              { i: 10, dy: -0.0652, da: 3.67 },
            ],
            stiff: 2.7,
          },
          long: { flick: 0.002, bottom: 0.85 },
        },
      },
      face: {
        blush: { cheeks: { on: true }, nose: { on: true } },
        parts: { mouth: "image" },
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
        tail: { kind: "pony", y: 0.95, length: 0.62, lift: 0.1, size: 0.5, wave: 0.016, tie: { on: false } },
        ahoge: false,
        sculpt: {
          nendo: { puff: 0.011 },
          shortLocks: { below: 0.12, flick: -0.026 },
          long: { count: 16, bottom: 0.725 },
        },
      },
      face: { parts: { eyes: "image", brows: "image", mouth: "image" } },
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
