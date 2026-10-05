// Options: every value that defines a character, with defaults (today's character).
// User options are deep-merged over DEFAULTS. `sculpt` sections are fine-tuning; most users never touch them.
import { partIds } from "./face/names.js";

export const DEFAULTS = {
  "colors": {
    "skin": "#ffe0c8",
    "hair": "#6a4a30",
    "eyes": "#4f6a9a"
  },
  "outline": {
    "on": true,
    "width": 1,
    "color": "#3a2a3a"
  },
  "shading": {
    "style": "toon",
    "bands": 2,
    "soften": 1
  },
  "body": {
    "head": {
      "scale": 0.9,
      "width": 1,
      "depth": 1,
      "pivotY": 0.845,
      "pivotZ": 0.006,
      "shift": {
        "z": 0.03,
        "z0": -0.08,
        "z1": 0.06
      }
    },
    "torso": {
      "chest": 1,
      "belly": 1,
      "waist": 0,
      "hips": 1,
      "bust": 0,
      "butt": 1,
      "back": 1
    },
    "thickness": {
      "upperArm": 1,
      "forearm": 1,
      "thigh": 1,
      "thighTop": 0.9,
      "calf": 1
    },
    "joints": {
      "hipY": 0.44,
      "footX": 0.116,
      "kneeX": 0.108
    },
    "sculpt": {
      "skull": {
        "width": 0.198,
        "height": 0.24,
        "depth": 0.262,
        "y": 1.108
      },
      "neck": {
        "width": 0.85,
        "nape": {
          "on": true,
          "y0": 0.82,
          "y1": 0.96,
          "z0": -0.025,
          "z1": -0.035,
          "r": 0.04,
          "k": 0.04
        }
      },
      "socketScale": 1,
      "faceNarrow": {
        "k": 1,
        "y0": 1.02,
        "y1": 1.12
      },
      "skullTop": {
        "extra": 0,
        "y": 1.17,
        "z": 0.02,
        "ry": 0.1,
        "rz": 0.2
      },
      "cheeks": {
        "width": 0.175,
        "y": 0.935,
        "height": 0.115
      },
      "chin": {
        "y": 0.835,
        "curve": 0.95,
        "k": 0.015,
        "sharp": 0,
        "sharpZ": [-0.02, 0.14],
        "backZ": 0.12,
        "backRise": 0.7,
        "backMax": 0.07,
        "point": 0,
        "pointW": 0.02,
        "sides": 0,
        "v": {
          "on": false,
          "halfW": 0.02,
          "slope": 1.3,
          "y0": 0.97,
          "fadeY": 0.08,
          "z0": 0.04,
          "fadeZ": 0.06,
          "k": 0.025
        },
        "napeY": 0.95,
        "napeZ": 0,
        "napeDrop": 0
      },
      "jawU": {
        "on": 1,
        "rx": 0.165,
        "ry": 0.12,
        "y": 0.96,
        "z0": 0.02,
        "open": 1.5,
        "k": 0.03
      },
      "noseGroove": {
        "depth": 0,
        "y": 0.952,
        "rx": 0.024,
        "ry": 0.03,
        "width": 0.014
      },
      "jaw": {
        "width": 0.112
      },
      "chinTip": {
        "on": false,
        "y": 0.805,
        "z": 0.16,
        "rx": 0.013,
        "ry": 0.038,
        "rz": 0.05,
        "k": 0.03
      },
      "backPlane": {
        "z": 0,
        "k": 0.05,
        "tilt": 0.2
      },
      "faceBox": {
        "on": 1,
        "y": 1.02,
        "height": 0.12,
        "width": 0.155,
        "front": 0.21,
        "depth": 0.12,
        "round": 0.05,
        "blend": 0.04,
        "cutFront": 0,
        "cutY0": 0.95,
        "cutY1": 1.3,
        "cutK": 0.02,
        "cutSlope": 2,
        "sideX": 0,
        "sideZ": 0.06,
        "sideK": 0.03,
        "sideSlope": 1.5
      },
      "foot": {
        "thickness": 0.029
      },
      "shoulders": {
        "drop": 0.008
      },
      "pelvis": {
        "squash": 1,
        "blend": 0.12
      },
      "buttY": 0.44,
      "armpit": {
        "x": 0.105,
        "y": 0.67,
        "margin": 0.006,
        "round": 0.03,
        "blend": 0.025,
        "depth": 0.07
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
        "width": 0.085,
        "height": 0.06,
        "heightUp": 0.11
      },
      "ears": {
        "hollow": {
          "on": false,
          "cu": 0.008,
          "cv": 0,
          "ru": 0.036,
          "rv": 0.048,
          "depth": 0.008,
          "shift": 0.022,
          "inner": 0.9,
          "soft": 0.25
        },
        "turn": 0,
        "blend": 0.02,
        "lobe": 0,
        "lobeIn": 0.004,
        "lobeFill": {
          "out": 0.035,
          "up": -0.025
        },
        "scale": 1,
        "x": null,
        "y": 0.958,
        "trimAngle": 0.35,
        "trimDepth": 0.04
      },
      "muzzle": {
        "width": 0.075,
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
        "blend": 0.02,
        "lift": 0
      },
      "mouth": {
        "curve": 45,
        "free": 0.95,
        "cheekBack": 0,
        "cheekBackWidth": 0.06,
        "back": 0
      },
      "crown": {
        "y": 1.32,
        "blend": 0.05,
        "tilt": 0,
        "pivotZ": -0.12
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
        "topDrop": 0.03,
        "back": {
          "y": 0.31,
          "z": -0.045,
          "height": 0.085,
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
          "y": 0.31,
          "width": 0.042,
          "height": 0.09
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
      "on": true,
      "color": "#7fb6e8",
      "sleeve": "short",
      "length": "tuck",
      "underarm": "fit",
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
      "on": true,
      "color": "#5a4f7a",
      "kind": "pants",
      "length": "shorts",
      "skirt": {
        "hem": 0.3,
        "flare": 0.4,
        "pleats": 16,
        "pleatDepth": 0.008,
        "thick": 0.018,
        "follow": 0.85
      },
      "hem": 0.3,
      "offset": 0.016,
      "top": 0.505,
      "tilt": 0.12
    },
    "armor": {
      "on": false,
      "style": "light",
      "color": "#b9c2ce",
      "mailColor": "#4b4d58",
      "visorColor": "#16141c",
      "helm": "great",
      "deco": "none",
      "decoColor": null,
      "gap": 0.022,
      "thick": 0.009
    },
    "weapon": {
      "right": "none",
      "left": "none",
      "shieldMount": "diagonal",
      "color": "#c9d0da",
      "gripColor": "#7a5236",
      "shieldColor": "#3f63b8"
    },
    "shoes": {
      "on": true,
      "color": "#c8564b",
      "soleColor": "#f4f1ea",
      "offset": 0.012,
      "top": 0.095,
      "tilt": 0.25,
      "sole": 0.02,
      "rim": 0.008
    },
    "socks": {
      "on": true,
      "color": "#f7f3ea",
      "top": 0.15
    }
  },
  "hair": {
    "paint": {
      "strands": {
        "on": true,
        "count": 30,
        "width": 0.12,
        "strength": 0.2,
        "wobble": 0.06,
        "start": 0.25
      },
      "ring": {
        "on": true,
        "color": null,
        "strength": 0.5,
        "center": 0.95,
        "width": 0.05,
        "zig": 0.07,
        "teeth": 30
      }
    },
    "bangs": "nendo",
    "drawn": [],
    "back": "hang",
    "ahoge": true,
    "sculpt": {
      "hime": {
        "tips": [[-80, 0.87], [-71, 0.87], [-62, 0.87], [-46, 1.025], [-34, 1.025], [-23, 1.025], [-11.5, 1.025], [0, 1.025], [11.5, 1.025], [23, 1.025], [34, 1.025], [46, 1.025], [62, 0.87], [71, 0.87], [80, 0.87]],
        "span": 86,
        "thick": 0.048,
        "smooth": true,
        "overEars": true,
        "slits": [[-40, 0.06, 0.014], [-17.25, 0.08, 0.015], [5.75, 0.05, 0.013], [28.5, 0.07, 0.015]],
        "curl": 0.035,
        "curlY0": 1.0,
        "curlY1": 0.87,
        "curlX": 0.1,
        "slope": 2,
        "curve": 4,
        "round": 0.006,
        "groove": 0.014,
        "grooveW": 3,
        "sweepLen": 0.16
      },
      "lumps": {
        "amp": 0.013,
        "count": 9,
        "twist": -0.7,
        "sharp": 0.5,
        "from": 0.2
      },
      "nendo": {
        "tips": [[-81.52, 0.887, 0.69, 0.33, null, 6], [-56.458, 0.917, 0.5, 0, null, 5.5], [-42, 1.045], [-36.124, 0.954], [5.627, 0.962, 0.8, 0.04, "c"], [13.563, 0.966, 0.8, 0, "c"], [27.929, 0.944], [41.397, 0.924], [59.583, 0.915, 0.5, 0, null, -3.5], [84, 0.87, 0.66, -0.33, null, -12.5]],   // 2026-10-02 ふさのエディタで作った形(ユーザー)。[角度, 毛先の高さ, 傾き?, 片寄り?, 組?, 流れ(度)?, 厚さの足し(m)?]
        "round": 0.014,
        "slope": 0.5,
        "span": 92,
        "thick": 0.036,
        "extra": 0.012,
        "sweepLen": 0.16,
        "top": 1.25,
        "groove": 0.02,
        "grooveW": 5,
        "root": 55,
        "locks": true,
        "lockThick": 0.22,
        "overlap": 1.25,
        "puff": 0.012,
        "lockStiff": 4,
        "lockSpan": 13,
        "lockRise": 0.03,
        "lockHangY": 0.86,
        "lockRoot": 70,
        "lockRootSpread": 0.45,
        "lockTaper": 0.08,
        "width": 1,
        "flat": 0.42,
        "lift": 0.022,
        "tipPow": 2.2,
        "clumps": [
          [0, -4, -13, 0.07, -4],
          [-16, -20, -10, 0.068, -3],
          [16, 22, -11, 0.068, 4],
          [-32, -38, -14, 0.064, -3],
          [32, 38, -12, 0.064, 3],
          [-48, -55, -20, 0.058, -2],
          [48, 55, -18, 0.058, 2],
          [-64, -70, -40, 0.05, 0],
          [64, 70, -40, 0.05, 0]
        ]
      },
      "shortLocks": {
        "on": true,
        "count": 15,
        "span": 115,
        "width": 0.075,
        "thick": 0.25,
        "ph": [64, 44],
        "below": 0.01,
        "flick": 0,
        "edits": [],
        "lie": {
          "count": 17,
          "span": 135,
          "width": 0.09,
          "thick": 0.32,
          "puff": 0.006,
          "flick": 0.02,
          "edits": [],
          "ph": [74, 54]
        },
        "vary": 0.15,
        "stiff": 3
      },
      "nape": {
        "on": true,
        "y0": 0.88,
        "y1": 1.04,
        "thin": 0.2,
        "k": 0.06
      },
      "shortBack": 0.86,
      "shell": 0.036,
      "lockShell": 0.016,
      "ahogeSize": 1.15,
      "ahogeDir": 90,
      "long": {
        "locks": true,
        "hug": false,
        "count": 13,
        "span": 110,
        "width": 0.075,
        "thick": 0.3,
        "flick": 0,
        "edits": [],
        "stiff": 1,
        "damping": 0.9,
        "yc": 1.0,
        "zc": -0.02,
        "bottom": 0.55,
        "spread": 0.25,
        "tips": 0.035,
        "teeth": 9,
        "curve": 0.8
      },
      "bob": {
        "tips": 0.045,
        "teeth": 8,
        "sharp": 3,
        "flare": 0.045
      },
      "taper": 0,
      "taperBack": 0,
      "backVolume": 0.02,
      "backVolumeZ": [0.1, -0.06],
      "backVolumeY": [0.98, 1.15],
      "backVolumeTop": [1.18, 1.32],
      "earGap": {
        "gap": 0.01,
        "k": 0.006
      },
      "corner": null,
      "taperSides": null,
      "square": 1,
      "hairline": 1.203,
      "peak": {
        "depth": 0.015,
        "width": 25
      }
    }
  },
  "face": {
    "earShade": {
      "on": false,
      "color": "#ccab9f",
      "strength": 1,
      "cu": 0.006,
      "cv": 0.002,
      "ru": 0.038,
      "rv": 0.05,
      "shift": 0.022,
      "soft": 0.45
    },
    "earLine": {
      "on": false,
      "color": "#74463f",
      "width": 0.0024,
      "lift": 0.001,
      "a0": 110,
      "a1": -55,
      "cu": 0.008,
      "cv": 0,
      "ru": 0.032,
      "rv": 0.044
    },
    "jawShadow": {
      "on": false,
      "color": "#cfa294",
      "jawNy": [0.75, 0.95],
      "jawY": [0.8, 0.84, 0.9, 0.95],
      "backZ": -0.02,
      "neckY": [0.74, 0.8, 0.84, 0.86],
      "neckX": [0.03, 0.07]
    },
    "blush": {
      "cheeks": {
        "on": false,
        "color": "#ff8a73",
        "strength": 0.45,
        "size": 0.042,
        "x": 0.15,
        "y": 0.95
      },
      "nose": {
        "on": false,
        "color": "#ff8a73",
        "strength": 0.4,
        "size": 0.016
      }
    },
    "noseShadow": {
      "on": false,
      "y": 0.927,
      "width": 0.02,
      "height": 0.0075,
      "color": "#a8786290"
    },
    "parts": {
      "eyes": "round",
      "brows": "normal",
      "mouth": "smile",
      "cheeks": "none",
      "nose": null
    },
    "eyeSize": 1.25,
    "layout": {
      "eyeX": 0.096,
      "eyeY": 0.998,
      "browX": 0.088,
      "browY": 1.092,
      "mouthY": 0.896
    },
    "images": {
      "eye": {
        "src": null,
        "width": 0,
        "dx": 0.004,
        "dy": 0.004
      },
      "eyeClosed": {
        "src": null,
        "width": 0,
        "dx": 0.004,
        "dy": 0.004
      },
      "brow": {
        "src": null,
        "width": 0,
        "dx": 0.004,
        "dy": 0
      },
      "mouth": {
        "src": null,
        "width": 0,
        "dy": 0
      },
      "nose": {
        "src": null,
        "width": 0,
        "dy": 0
      }
    },
    "drawn": [],
    "shading": {
      "weight": 1,
      "y": 0.96,
      "z": -0.02,
      "radiusY": 0.7,
      "radiusZ": 0.2
    }
  }
};

// Old short URL names used while sculpting (e.g. ?nz=0.27) → option paths. Handy for quick tuning in the browser.
export const SHORT = {
  "hy": "body.joints.hipY",
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
  "tdr": "body.sculpt.thigh.topDrop",
  "bty": "body.sculpt.buttY",
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

// A fresh copy every time (the avatar writes instant changes back into it, so it must never share objects with DEFAULTS or the caller).
// Face parts given with the old Japanese names become ids.
export const resolveOptions = (user) => { const o = structuredClone(merge(DEFAULTS, user)); Object.assign(o.face.parts, partIds(user?.face?.parts)); return o; };

/** Only what differs from base (e.g. a recipe without its defaults, for "copy as code"). Arrays and values compare as a whole. */
export function diff(base, opt) {
  const out = {};
  for (const [k, v] of Object.entries(opt || {})) {
    const b = base?.[k];
    if (isObj(v) && isObj(b)) { const d = diff(b, v); if (Object.keys(d).length) out[k] = d; }
    else if (JSON.stringify(v) !== JSON.stringify(b)) out[k] = v;
  }
  return out;
}
