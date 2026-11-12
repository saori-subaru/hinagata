// The town's people: recipes for a crowd (passers-by, shop customers), each a body type (body/types.js) dressed. createAvatar(CROWD.police).
// Plain options of today's version (a bare options object: the current defaults), so merge your own over a copy to vary them
// (colors, hair). Build a crowd at { quality: "lite" } (a salaryman 1.6 万 triangles; an adult's default "fine" 4.4 万). The hair is the solid form ("block"): the locks' physics costs more, and a cap fits over the block only.
import { BODY_TYPES } from "./body/types.js";

const body = (t) => structuredClone(BODY_TYPES[t].body);
const MAN_HAIR = { back: "short", bangs: "side", nape: "lie", ahoge: false, backForm: "block", bangsForm: "block" };
const MAN_FACE = { eyeSize: 0.9, parts: { eyes: "lidded" } };
const KID_HAIR = { ahoge: false, backForm: "block", bangsForm: "block" };
const dark = { shoes: { color: "#1c1a1a", soleColor: "#0e0d0d" }, socks: { color: "#1c1a1a" } };
// a dress shirt's neckline: close round the neck up to the throat (the crew neck left the tie's knot hanging under bare skin)
const DRESS = { y: 0.8, bowl: 8, front: 0.08 };
const suit = (c, tie) => ({ shirt: { color: "#f4f4f0", sleeve: "long", length: "tuck", collar: { ...DRESS }, shirtCollar: { on: true, color: "#f4f4f0" }, tie: { on: true, color: tie } },
  jacket: { on: true, color: c }, pants: { length: "long", color: c, bell: 0.3 }, ...dark });

export const CROWD = {
  salaryman: { body: body("manAdult"), hair: MAN_HAIR, face: MAN_FACE, outfit: suit("#2f3442", "#7a2a36") },
  manager: { body: body("middleAdult"), hair: MAN_HAIR, face: MAN_FACE, outfit: suit("#3b3a40", "#2c4a6e") },
  officeLady: { body: body("girlAdult"), hair: { back: "bob", ahoge: false, backForm: "block", bangsForm: "block" },
    outfit: { ...suit("#2f3442", "#2f3442"), jacket: { on: true, color: "#2f3442", pad: 0.25, lapel: 0.03, buttons: 1 }, shirt: { color: "#f4f4f0", sleeve: "long", length: "tuck", collar: { ...DRESS }, shirtCollar: { on: true, color: "#f4f4f0" } }, pants: { kind: "skirt", color: "#2f3442" } } },
  elder: { body: body("elderAdult"), hair: MAN_HAIR, face: MAN_FACE, colors: { hair: "#c9c6c0" },
    outfit: { shirt: { color: "#b9a88a", sleeve: "long", length: "out" }, pants: { length: "long", color: "#5b5348" }, ...dark } },
  sumo: { body: body("sumoAdult"), hair: MAN_HAIR, face: MAN_FACE, colors: { hair: "#1a1716" },
    outfit: { shirt: { color: "#3a4a6a", sleeve: "bell", length: "out" }, pants: { length: "long", color: "#3a4a6a" }, shoes: { color: "#c9b48a" } } },   // (a dress as a yukata tore over the belly)
  police: { body: body("manAdult"), hair: MAN_HAIR, face: MAN_FACE,
    outfit: { ...suit("#1f2840", "#1f2840"), shirt: { color: "#9fc3e6", sleeve: "long", length: "tuck", collar: { ...DRESS }, shirtCollar: { on: true, color: "#9fc3e6" }, tie: { on: true, color: "#1f2840" } }, cap: { on: true, color: "#1f2840" } } },
  postman: { body: body("manAdult"), hair: MAN_HAIR, face: MAN_FACE,
    outfit: { shirt: { color: "#dfe6ee", sleeve: "long", length: "tuck", collar: { ...DRESS }, shirtCollar: { on: true, color: "#dfe6ee" } }, pants: { length: "long", color: "#2b3b5c" }, cap: { on: true, color: "#2b3b5c", flare: 0.008 }, ...dark } },
  stationStaff: { body: body("manAdult"), hair: MAN_HAIR, face: MAN_FACE, outfit: { ...suit("#24324a", "#24324a"), cap: { on: true, color: "#24324a", flare: 0.012 } } },
  kappogi: { body: body("girlAdult"), hair: { back: "bob", ahoge: false, backForm: "block", bangsForm: "block" },
    outfit: { shirt: { color: "#f6f4ee", sleeve: "bell", length: "out" }, dress: { on: true, color: "#f6f4ee", hem: 0.24 }, pants: { length: "long", color: "#5d4a6a" } } },
  monk: { body: body("elderAdult"), hair: MAN_HAIR, face: MAN_FACE, colors: { hair: "#3a3530" },
    outfit: { shirt: { color: "#1d1d22", sleeve: "bell", length: "out", kesa: { on: true } }, dress: { on: true, color: "#1d1d22", hem: 0.1, flare: 0.25 }, pants: { length: "long", color: "#1d1d22" }, shoes: { color: "#f0eadc" } } },
  schoolboy: { body: body("standardTall"), hair: KID_HAIR,
    outfit: { shirt: { color: "#22252e", sleeve: "long" }, pants: { length: "long", color: "#22252e" }, randoseru: { on: true, color: "#222222" }, cap: { on: true, color: "#22252e", flare: 0, visor: 0.07 } } },
  schoolgirl: { body: body("girlTall"), hair: { back: "bob", ahoge: false, backForm: "block", bangsForm: "block" },
    outfit: { shirt: { color: "#f4f4f0" }, pants: { kind: "skirt", color: "#2f3a5a" }, randoseru: { on: true } } },
};
// a crew neck: the shirt's default neckline is a wide boat neck, open to the shoulders
const CREW = { y: 0.79, bowl: 6, front: 0.2 };
for (const r of Object.values(CROWD)) { for (const k of Object.keys(r.outfit)) if (r.outfit[k] === undefined) delete r.outfit[k]; if (r.outfit.shirt) r.outfit.shirt.collar ??= { ...CREW }; }
