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
      colors: { skin: "#fee9d7", hair: "#fff7f0", eyes: "#41714d" },
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
        dress: { gradient: { color: "#d5e3d7", start: 0.7, soft: 0.5 }, on: true, color: "#ffffff", hem: 0.31, pleats: 0, under: 0.035, underColor: "#55776b", underPleats: 20,
          texture: { src: SYLVIE_DRESS, mode: "front", scale: 0.6, y: 0.66 } },
        pants: { on: false, kind: "skirt" },
        armor: { helm: "close", deco: "plume" },
        weapon: { shieldMount: "straight" },
        shoes: { kind: "boots", color: "#66907d", sole: 0.035, straps: 2, strapAt: 0.028, strapWidth: 0.009, strapGap: 0.009 },
      },
      accessories: [   // the collar: two buttons with an X, a tab hanging under each with a tassel (offsets from upperChest, as built)
        { kind: "tab", bone: "upperChest", at: [0.04, -0.004, 0.152], n: [0, 0, 1], size: 0.075, color: "#a3bbac", mirror: true },
        { kind: "tassel", bone: "upperChest", at: [0.04, -0.075, 0.153], n: [0, 0, 1], size: 0.045, color: "#efe8dc", mirror: true },
        { kind: "button", bone: "upperChest", at: [0.04, 0.002, 0.152], n: [-0.15, 0.15, 0.97], size: 0.04, color: "#efe8dc", mirror: true, lift: 0.002 },
        { kind: "cross", bone: "upperChest", at: [0.04, 0.002, 0.152], n: [-0.15, 0.15, 0.97], size: 0.025, color: "#66907d", mirror: true, lift: 0.0105 },
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
