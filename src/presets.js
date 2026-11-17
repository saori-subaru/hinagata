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
        shirt: { on: false, sleeve: "bell", bell: 0.04, underarm: "loose", cuffColor: "#66907d", cuffLine: "#efe8dc", cuffWidth: 0.03 },
        cape: { on: true, color: "#66907d", hem: 0.53, flare: 0.45, sway: 0.25, front: "closed", close: 0.715, open: 0.5, tilt: 0.25, hood: true, hoodRim: false, neckOpen: 0.07, line: "#efe8dc",
          texture: { src: SYLVIE_CAPE, mode: "hem", scale: 0.47 } },
        dress: { gradient: { color: "#d5e3d7", start: 0.7, soft: 0.5 }, on: true, color: "#ffffff", waist: 0.63, hem: 0.37, flare: 0.55, pleats: 0, under: 0.05, underColor: "#55776b", underPleats: 20,
          sideDrop: 0.035, sideAt: 0.6, sideOut: 0.01, middleBack: false, cinch: 0.012, cinchAt: 0.53, tabDrop: 0.0245, tabAt: 0.115, tabWidth: 0.056,
          texture: { src: SYLVIE_DRESS, mode: "front", scale: 0.5, y: 0.72 } },
        pants: { on: false, kind: "skirt" },
        armor: { helm: "close", deco: "plume" },
        weapon: { shieldMount: "straight" },
        shoes: { kind: "boots", color: "#66907d", sole: 0.035, straps: 2, strapAt: 0.028, strapWidth: 0.009, strapGap: 0.009 },
      },
      accessories: [   // the collar: two buttons with an X at the hood's rim's ends, a cord between them, a tab hanging under each with a tassel (offsets from upperChest, as built)
        { kind: "tab", bone: "upperChest", at: [0.041, 0.02, 0.153], n: [-0.15, 0.2, 0.97], size: 0.075, color: "#a3bbac", mirror: true },   // along the cape (it comes forward under the button)
        { kind: "tassel", bone: "upperChest", at: [0.039, -0.0518, 0.1676], n: [0, 0, 1], size: 0.045, color: "#efe8dc", mirror: true },   // from the tab's end
        { kind: "cord", bone: "upperChest", at: [0, 0.0264, 0.149], n: [0, 0, 1], size: 0.08, color: "#efe8dc", lift: 0.003 },
        { kind: "button", bone: "upperChest", at: [0.041, 0.0264, 0.149], n: [-0.12, 0.32, 0.94], size: 0.054, color: "#efe8dc", mirror: true, lift: 0.002 },
        { kind: "cross", bone: "upperChest", at: [0.041, 0.0264, 0.149], n: [-0.12, 0.32, 0.94], size: 0.034, color: "#66907d", mirror: true, lift: 0.0138 },
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
