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
        cape: { on: true, color: "#66907d", hem: 0.53, flare: 0.45, sway: 0.25, front: "closed", close: 0.715, open: 0.5, tilt: 0.25, hood: true, hoodRim: false, neckOpen: 0.07, line: "#efe8dc",
          texture: { src: SYLVIE_CAPE, mode: "hem", scale: 0.47 } },
        dress: { gradient: { color: "#d5e3d7", start: 0.7, soft: 0.5 }, on: true, color: "#ffffff", waist: 0.63, hem: 0.4, flare: 0.55, pleats: 0, under: 0.06, underColor: "#55776b", underPleats: 20,
          sideDrop: 0.035, sideAt: 0.6, sideOut: 0.01, middleBack: false, cinch: 0.012, cinchAt: 0.53,
          texture: { src: SYLVIE_DRESS, mode: "front", scale: 0.5, y: 0.73 } },
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
