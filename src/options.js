// Options: every value that defines a character, with defaults (today's character).
// User options are deep-merged over DEFAULTS. `sculpt` sections are fine-tuning; most users never touch them.

export const DEFAULTS = {
  "body": {
    "joints": {
      "footX": 0.116,
      "kneeX": 0.108
    },
    "sculpt": {
      "foot": {
        "thickness": 0.029
      },
      "shoulders": {
        "drop": 0.008
      },
      "temple": {
        "minZ": 0.09,
        "depth": 0.006,
        "x": 0.19,
        "y": 0.98,
        "height": 0.13
      },
      "cheekTrim": {
        "depth": 0.008,
        "x": 0.2,
        "y": 0.9,
        "width": 0.05,
        "height": 0.08
      },
      "cheekFill": {
        "depth": 0.008,
        "x": 0.125,
        "y": 0.905,
        "width": 0.095,
        "height": 0.06
      },
      "underEye": {
        "depth": 0.01,
        "x": 0.105,
        "y": -0.032,
        "widthInner": 0.05,
        "widthOuter": 0.032,
        "height": 0.035
      },
      "socketInner": {
        "depth": 0.005,
        "x": 0.075,
        "width": 0.055
      },
      "socketBand": {
        "length": 0.11,
        "lift": 0.6
      },
      "socketLow": {
        "depth": 0.014,
        "heightUp": 0.11
      },
      "ears": {
        "y": 0.983,
        "trimAngle": 0.35,
        "trimDepth": 0.04
      },
      "muzzle": {
        "y": 0.925,
        "baseY": 0.905
      },
      "nose": {
        "tipZ": 0.267,
        "under": {
          "dent": 0,
          "dentY": 0.915,
          "y": -0.002,
          "slope": 0.5
        },
        "tipRadius": 0.0045,
        "blend": 0.02
      },
      "mouth": {
        "curve": 45,
        "free": 0.95
      },
      "crown": {
        "y": 1.39,
        "blend": 0.02
      },
      "forearm": {
        "wristRadius": 0.032,
        "elbowBlend": 0.01,
        "bulge": {
          "start": 0.3,
          "offset": 0.004,
          "radius": 0.0445,
          "radiusEnd": 0.041,
          "blend": 0.03,
          "flat": 0.64
        }
      },
      "thigh": {
        "back": {
          "y": 0.335,
          "z": -0.045,
          "height": 0.055,
          "depth": 0.046
        },
        "front": {
          "y": 0.33,
          "z": 0.035,
          "width": 0.055,
          "height": 0.125,
          "depth": 0.06,
          "blend": 0.05
        },
        "inner": {
          "x": 0.062,
          "y": 0.34,
          "width": 0.042,
          "height": 0.06
        }
      },
      "calf": {
        "outer": {
          "x": 0.018,
          "y": 0.175,
          "width": 0.036,
          "height": 0.06
        },
        "back": {
          "z": -0.017,
          "width": 0.055,
          "depth": 0.058
        }
      },
      "crotch": {
        "y": 0.29,
        "width": 0.025,
        "height": 0.075
      },
      "knee": {
        "outer": {
          "x": 0.088,
          "y": 0.25,
          "width": 0.012,
          "height": 0.03
        },
        "inner": {
          "y": 0.22,
          "width": 0.035,
          "height": 0.1
        }
      }
    }
  },
  "quality": {
    "headCell": 0.025,
    "bodyCell": 0.04,
    "project": 1,
    "band": 6,
    "hairCell": 0.85,
    "shirtCell": 0.75
  },
  "outfit": {
    "shirt": {
      "collar": {
        "y": 0.764,
        "bowl": 2.2,
        "tilt": 0.3,
        "front": 0.35,
        "forward": 0.01
      },
      "shoulderFit": {
        "x0": 0,
        "xWidth": 0.13,
        "offset": 0.006,
        "y0": 0.67,
        "y1": 0.75
      }
    },
    "pants": {
      "hem": 0.3,
      "offset": 0.016,
      "top": 0.505,
      "tilt": 0.25
    },
    "shoes": {
      "offset": 0.012,
      "top": 0.095,
      "tilt": 0.25,
      "sole": 0.02,
      "rim": 0.008
    },
    "socks": {
      "top": 0.15
    }
  },
  "hair": {
    "bangs": "none",
    "back": "short",
    "ahoge": false,
    "sculpt": {
      "shortBack": 0.86
    }
  },
  "face": {
    "layout": {
      "browY": 1.09
    },
    "images": {
      "eye": {
        "width": 0,
        "dx": 0.004,
        "dy": 0.004
      },
      "brow": {
        "width": 0,
        "dx": 0.004,
        "dy": 0
      },
      "mouth": {
        "width": 0,
        "dy": 0
      }
    },
    "shading": {
      "weight": 1,
      "y": 1.04,
      "z": -0.02,
      "radiusY": 0.31,
      "radiusZ": 0.2
    }
  }
};

// Old short URL names used while sculpting (e.g. ?nz=0.27) → option paths. Handy for quick tuning in the browser.
export const SHORT = {
  "fx": "body.joints.footX",
  "kx": "body.joints.kneeX",
  "fh": "body.sculpt.foot.thickness",
  "sdrop": "body.sculpt.shoulders.drop",
  "tz0": "body.sculpt.temple.minZ",
  "td": "body.sculpt.temple.depth",
  "tx": "body.sculpt.temple.x",
  "ty": "body.sculpt.temple.y",
  "th": "body.sculpt.temple.height",
  "sd": "body.sculpt.cheekTrim.depth",
  "sx": "body.sculpt.cheekTrim.x",
  "sy": "body.sculpt.cheekTrim.y",
  "sw": "body.sculpt.cheekTrim.width",
  "sh": "body.sculpt.cheekTrim.height",
  "cf": "body.sculpt.cheekFill.depth",
  "cfx": "body.sculpt.cheekFill.x",
  "cfy": "body.sculpt.cheekFill.y",
  "cfw": "body.sculpt.cheekFill.width",
  "cfh": "body.sculpt.cheekFill.height",
  "eud": "body.sculpt.underEye.depth",
  "eux": "body.sculpt.underEye.x",
  "euy": "body.sculpt.underEye.y",
  "euwi": "body.sculpt.underEye.widthInner",
  "euwo": "body.sculpt.underEye.widthOuter",
  "euh": "body.sculpt.underEye.height",
  "sid": "body.sculpt.socketInner.depth",
  "six": "body.sculpt.socketInner.x",
  "siw": "body.sculpt.socketInner.width",
  "blen": "body.sculpt.socketBand.length",
  "blift": "body.sculpt.socketBand.lift",
  "low": "body.sculpt.socketLow.depth",
  "lhu": "body.sculpt.socketLow.heightUp",
  "eary": "body.sculpt.ears.y",
  "my": "body.sculpt.muzzle.y",
  "nz": "body.sculpt.nose.tipZ",
  "pb": "body.sculpt.mouth.curve",
  "m2y": "body.sculpt.muzzle.baseY",
  "nd": "body.sculpt.nose.under.dent",
  "ndy": "body.sculpt.nose.under.dentY",
  "ny": "body.sculpt.nose.under.y",
  "ns": "body.sculpt.nose.under.slope",
  "mf": "body.sculpt.mouth.free",
  "nr": "body.sculpt.nose.tipRadius",
  "nk": "body.sculpt.nose.blend",
  "crown": "body.sculpt.crown.y",
  "crk": "body.sculpt.crown.blend",
  "eta": "body.sculpt.ears.trimAngle",
  "etc": "body.sculpt.ears.trimDepth",
  "far": "body.sculpt.forearm.wristRadius",
  "ek": "body.sculpt.forearm.elbowBlend",
  "fbt": "body.sculpt.forearm.bulge.start",
  "fbo": "body.sculpt.forearm.bulge.offset",
  "fbr": "body.sculpt.forearm.bulge.radius",
  "fbe": "body.sculpt.forearm.bulge.radiusEnd",
  "fbk": "body.sculpt.forearm.bulge.blend",
  "ffl": "body.sculpt.forearm.bulge.flat",
  "tby": "body.sculpt.thigh.back.y",
  "tbz": "body.sculpt.thigh.back.z",
  "tbh": "body.sculpt.thigh.back.height",
  "tbd": "body.sculpt.thigh.back.depth",
  "tfy": "body.sculpt.thigh.front.y",
  "tfz": "body.sculpt.thigh.front.z",
  "tfw": "body.sculpt.thigh.front.width",
  "tfh": "body.sculpt.thigh.front.height",
  "tfd": "body.sculpt.thigh.front.depth",
  "tfk": "body.sculpt.thigh.front.blend",
  "tix": "body.sculpt.thigh.inner.x",
  "tiy": "body.sculpt.thigh.inner.y",
  "tiw": "body.sculpt.thigh.inner.width",
  "tih": "body.sculpt.thigh.inner.height",
  "cox": "body.sculpt.calf.outer.x",
  "coy": "body.sculpt.calf.outer.y",
  "cow": "body.sculpt.calf.outer.width",
  "coh": "body.sculpt.calf.outer.height",
  "cbz": "body.sculpt.calf.back.z",
  "cbw": "body.sculpt.calf.back.width",
  "cbd": "body.sculpt.calf.back.depth",
  "hc": "quality.headCell",
  "cry": "body.sculpt.crotch.y",
  "crw": "body.sculpt.crotch.width",
  "crh": "body.sculpt.crotch.height",
  "kox": "body.sculpt.knee.outer.x",
  "koy": "body.sculpt.knee.outer.y",
  "kow": "body.sculpt.knee.outer.width",
  "koh": "body.sculpt.knee.outer.height",
  "kiy": "body.sculpt.knee.inner.y",
  "kix": "body.sculpt.knee.inner.width",
  "kih": "body.sculpt.knee.inner.height",
  "bc": "quality.bodyCell",
  "cy": "outfit.shirt.collar.y",
  "cbo": "outfit.shirt.collar.bowl",
  "ctl": "outfit.shirt.collar.tilt",
  "cfr": "outfit.shirt.collar.front",
  "cfd": "outfit.shirt.collar.forward",
  "sfx": "outfit.shirt.shoulderFit.x0",
  "sfw": "outfit.shirt.shoulderFit.xWidth",
  "sfo": "outfit.shirt.shoulderFit.offset",
  "sf0": "outfit.shirt.shoulderFit.y0",
  "sf1": "outfit.shirt.shoulderFit.y1",
  "hem": "outfit.pants.hem",
  "pao": "outfit.pants.offset",
  "pat": "outfit.pants.top",
  "ptl": "outfit.pants.tilt",
  "sof": "outfit.shoes.offset",
  "stop": "outfit.shoes.top",
  "stl": "outfit.shoes.tilt",
  "ssh": "outfit.shoes.sole",
  "srm": "outfit.shoes.rim",
  "skt": "outfit.socks.top",
  "hb": "hair.sculpt.shortBack",
  "proj": "quality.project",
  "band": "quality.band",
  "by": "face.layout.browY",
  "iew": "face.images.eye.width",
  "iex": "face.images.eye.dx",
  "iey": "face.images.eye.dy",
  "ibw": "face.images.brow.width",
  "ibx": "face.images.brow.dx",
  "iby": "face.images.brow.dy",
  "imw": "face.images.mouth.width",
  "imy": "face.images.mouth.dy",
  "hr": "quality.hairCell",
  "fsw": "face.shading.weight",
  "fsy": "face.shading.y",
  "fsz": "face.shading.z",
  "fsry": "face.shading.radiusY",
  "fsrz": "face.shading.radiusZ",
  "shr": "quality.shirtCell"
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export function merge(base, over) {   // deep merge; arrays and values are replaced
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  return out;
}
export function setPath(obj, path, value) { const ks = path.split("."); let o = obj; for (const k of ks.slice(0, -1)) o = o[k] ??= {}; o[ks.at(-1)] = value; return obj; }

// Options from a query string: ?o=<JSON> and/or old short names (?nz=0.27&kx=0.11)
export function fromQuery(search) {
  const q = new URLSearchParams(search), out = {};
  if (q.has("o")) Object.assign(out, JSON.parse(q.get("o")));
  for (const [k, path] of Object.entries(SHORT)) if (q.has(k)) setPath(out, path, +q.get(k));
  return out;
}

export const resolveOptions = (user) => merge(DEFAULTS, user);
