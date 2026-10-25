// Reproducible preparation of the original Meshy body; excluded from gameplay imports.
import { CITY_HUNTER_PART_REGIONS, CITY_HUNTER_SPLIT_HAIR, CITY_HUNTER_SKIN_FILTERS, CITY_HUNTER_MASKED_BODY_REGIONS } from './CityHunterParts.js';

export const CITY_HUNTER_PREPARATION = {
  ...{
  "height": 4.31,
  "forwardAxis": "+z",
  "boneMap": {
    "hips": "Hips",
    "head": "Head",
    "neck": "neck",
    "leftArm": "LeftArm",
    "rightArm": "RightArm",
    "leftForeArm": "LeftForeArm",
    "rightForeArm": "RightForeArm",
    "leftHand": "LeftHand",
    "rightHand": "RightHand",
    "leftLeg": "LeftUpLeg",
    "rightLeg": "RightUpLeg",
    "leftLowerLeg": "LeftLeg",
    "rightLowerLeg": "RightLeg",
    "leftFoot": "LeftFoot",
    "rightFoot": "RightFoot"
  },
  "poseOffsets": {},
  "accessories": {
    "blade1": {
      "socket": "rightHand",
      "position": [
        -4.314177497813866,
        -4.240332814306186,
        0.2604836896044782
      ],
      "quaternion": [
        -0.5882636702095219,
        -0.12523156044195063,
        0.7884034239818056,
        0.12916250088420506
      ],
      "scale": [
        33.410667366437636,
        33.410670731094726,
        33.41067252714011
      ]
    },
    "blade2": {
      "socket": "rightHand",
      "position": [
        -5.8428594594081105,
        -2.2857938382590532,
        -4.724542256281047
      ],
      "quaternion": [
        -0.5882636702095219,
        -0.12523156044195063,
        0.7884034239818056,
        0.12916250088420506
      ],
      "scale": [
        33.410667366437636,
        33.410670731094726,
        33.41067252714011
      ]
    },
    "shieldMesh": {
      "socket": "leftHand",
      "position": [
        -22.514544592642643,
        -17.12774262617104,
        -1.1238462648685186
      ],
      "quaternion": [
        0.5295565608780474,
        -0.3264780877120403,
        0.13500337550854297,
        0.7712042502970297
      ],
      "scale": [
        40.092812953841104,
        40.092817522286886,
        40.09280829664882
      ]
    },
    "secWeaponMesh": {
      "socket": "leftHand",
      "position": [
        -5.598832056537013,
        2.965395227149415,
        4.364377468224461
      ],
      "quaternion": [
        0.5092734481905656,
        0.733543254890483,
        0.06932337134056979,
        -0.44468991258937357
      ],
      "scale": [
        47.33179490773033,
        47.3317895915184,
        47.33179460750215
      ]
    },
    "plasmaGlaiveMesh": {
      "socket": "rightHand",
      "position": [
        -8.401641285347438,
        13.14715708975615,
        -0.9989700767057821
      ],
      "quaternion": [
        -0.09810443139148013,
        0.8155305768137974,
        -0.5611365174122057,
        -0.1020353254986283
      ],
      "scale": [
        41.763340658925145,
        41.76333420804705,
        41.76333841386841
      ]
    },
    "clanMarkMesh": {
      "socket": "head",
      "position": [
        0.807600681450289,
        30.11202712751583,
        25.537915197280935
      ],
      "quaternion": [
        -0.44843711067277775,
        0.015382841021091848,
        0.0500400662849482,
        0.8922799548010527
      ],
      "scale": [
        55.83771035602739,
        55.83770826314817,
        55.83770628294154
      ]
    }
  },
  "cameraEyeHeight": 3.5392865829847246,
  "laserSight": {
    "origin": [
      0.33309235724380704,
      3.735383056129062,
      0.4960442361991596
    ],
    "radius": 0.012291587228861553
  },
  "biomask": {
    "assetKey": "city_hunter_biomask",
    "bone": "Head",
    "calibrated": true,
    "position": [
      1.3009527157328584,
      17.108935308187796,
      19.95013038229157
    ],
    "quaternion": [
      -0.05721948050946129,
      0.03786507687823525,
      0.03786508939303018,
      0.9969244715666733
    ],
    "scale": [
      36.19489933867826,
      31.183294371192204,
      41.76334548875402
    ]
  },
  "calibrated": false,
  "requirePreparation": true,
  "bakedWristblades": {
    "calibrated": true,
    "mode": "static"
  },
  "boneRestCorrections": {
    "version": 1,
    "calibrated": true,
    "sourceSha256": "bd962ad79d5034d6ac5c0d7fc03e185433d0784808ffc868e597c7656e6725e7",
    "joints": [
      {
        "bone": "LeftArm",
        "parent": "LeftShoulder",
        "position": [
          -24.129454994679115,
          -6.445566247060389,
          4.8692597110073725
        ]
      }
    ]
  }
},
  partRegions: CITY_HUNTER_PART_REGIONS,
  splitHair: CITY_HUNTER_SPLIT_HAIR,
  partSkinFilters: CITY_HUNTER_SKIN_FILTERS,
  maskedBodyRegions: CITY_HUNTER_MASKED_BODY_REGIONS,
};
