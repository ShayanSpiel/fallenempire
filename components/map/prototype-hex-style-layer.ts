import { Layer, project32, type LayerProps } from "@deck.gl/core";
import type { ShaderModule } from "@luma.gl/shadertools";
import { Model, Geometry } from "@luma.gl/engine";

export type PrototypeHexStyleLayerProps = LayerProps & {
  verticesLngLat: [number, number][];
  centerLngLat: [number, number];

  borderColor?: [number, number, number];
  borderMaxAlpha?: number;
  borderFadeRatio?: number;
  debugFillAlpha?: number;
  edgeMask?: [number, number, number, number, number, number];
  edgeMidPower?: number;

  sideEnabled?: boolean;
  sideDirLngLat?: [number, number];
  sideSoftnessRatio?: number;

  noiseEnabled?: boolean;
  noiseScale?: number;
  noiseAmount?: number;
  noisePaletteA?: [number, number, number];
  noisePaletteB?: [number, number, number];
  centerFadeInner?: number;
  centerFadeOuter?: number;
  noiseDotScale?: number;
  noiseDotSize?: number;
  noiseThreshold?: number;
  fillColorA?: [number, number, number];
  fillColorB?: [number, number, number];
  fillAlpha?: number;
  fillGradientPower?: number;
  fillGlossDirLngLat?: [number, number];
  fillGlossMagnitude?: number;
  fillGlossPower?: number;
  cubeEnabled?: boolean;
  cubeLineThickness?: number;
  cubeLineColor?: [number, number, number];
  cubeShadeBoost?: number;
  patternKind?: number;
};

type PrototypeHexStyleUniformProps = {
  center: [number, number];
  v0: [number, number];
  v1: [number, number];
  v2: [number, number];
  v3: [number, number];
  v4: [number, number];
  v5: [number, number];

  borderColor: [number, number, number];
  borderMaxAlpha: number;
  borderFadeRatio: number;
  debugFillAlpha: number;
  edgeMaskA: [number, number, number];
  edgeMaskB: [number, number, number];
  edgeMidPower: number;

  sideEnabled: number;
  sideDir: [number, number];
  sideSoftnessRatio: number;

  noiseEnabled: number;
  noiseScale: number;
  noiseAmount: number;
  noisePaletteA: [number, number, number];
  noisePaletteB: [number, number, number];
  centerFadeInner: number;
  centerFadeOuter: number;
  noiseDotScale: number;
  noiseDotSize: number;
  noiseThreshold: number;
  fillColorA: [number, number, number];
  fillColorB: [number, number, number];
  fillAlpha: number;
  fillGradientPower: number;
  fillGlossDir: [number, number];
  fillGlossMagnitude: number;
  fillGlossPower: number;
  cubeEnabled: number;
  cubeLineThickness: number;
  cubeLineColor: [number, number, number];
  cubeShadeBoost: number;
  patternKind: number;
};

const uniformBlock = `\
uniform prototypeHexStyleUniforms {
  vec2 center;
  vec2 v0;
  vec2 v1;
  vec2 v2;
  vec2 v3;
  vec2 v4;
  vec2 v5;

  vec3 borderColor;
  float borderMaxAlpha;
  float borderFadeRatio;
  float debugFillAlpha;
  vec3 edgeMaskA;
  vec3 edgeMaskB;
  float edgeMidPower;

  float sideEnabled;
  vec2 sideDir;
  float sideSoftnessRatio;

  float noiseEnabled;
  float noiseScale;
  float noiseAmount;
  vec3 noisePaletteA;
  vec3 noisePaletteB;
  float noiseDotScale;
  float noiseDotSize;
  float noiseThreshold;

  vec3 fillColorA;
  vec3 fillColorB;
  float fillAlpha;
  float fillGradientPower;
  vec2 fillGlossDir;
  float fillGlossMagnitude;
  float fillGlossPower;
  float cubeEnabled;
  float cubeLineThickness;
  vec3 cubeLineColor;
  float cubeShadeBoost;
  float patternKind;
  float centerFadeInner;
  float centerFadeOuter;
} prototypeHexStyle;
`;

export const prototypeHexStyleUniforms = {
  name: "prototypeHexStyle",
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    center: "vec2<f32>",
    v0: "vec2<f32>",
    v1: "vec2<f32>",
    v2: "vec2<f32>",
    v3: "vec2<f32>",
    v4: "vec2<f32>",
    v5: "vec2<f32>",

    borderColor: "vec3<f32>",
    borderMaxAlpha: "f32",
    borderFadeRatio: "f32",
    debugFillAlpha: "f32",
    edgeMaskA: "vec3<f32>",
    edgeMaskB: "vec3<f32>",
    edgeMidPower: "f32",

    sideEnabled: "f32",
    sideDir: "vec2<f32>",
    sideSoftnessRatio: "f32",

    noiseEnabled: "f32",
    noiseScale: "f32",
    noiseAmount: "f32",
    noisePaletteA: "vec3<f32>",
    noisePaletteB: "vec3<f32>",
    noiseDotScale: "f32",
    noiseDotSize: "f32",
    noiseThreshold: "f32",

    fillColorA: "vec3<f32>",
    fillColorB: "vec3<f32>",
    fillAlpha: "f32",
    fillGradientPower: "f32",
    fillGlossDir: "vec2<f32>",
    fillGlossMagnitude: "f32",
    fillGlossPower: "f32",
    cubeEnabled: "f32",
    cubeLineThickness: "f32",
    cubeLineColor: "vec3<f32>",
    cubeShadeBoost: "f32",
    patternKind: "f32",
    centerFadeInner: "f32",
    centerFadeOuter: "f32",
  },
} as const satisfies ShaderModule<PrototypeHexStyleUniformProps>;

const vs = `\
#version 300 es
#define SHADER_NAME prototype-hex-style-layer-vertex

in vec3 positions;
in vec3 positions64Low;

out vec2 vLngLat;

void main(void) {
  vLngLat = positions.xy;
  gl_Position = project_position_to_clipspace(positions, positions64Low, vec3(0.));
}
`;

const fs = `\
#version 300 es
#define SHADER_NAME prototype-hex-style-layer-fragment

precision highp float;

in vec2 vLngLat;
out vec4 fragColor;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float segmentDistanceAndT(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = dot(pa, ba) / dot(ba, ba);
  t = clamp(h, 0.0, 1.0);
  return length(pa - ba * t);
}

float minDistanceToHexEdge(vec2 p) {
  vec2 v0 = prototypeHexStyle.v0;
  vec2 v1 = prototypeHexStyle.v1;
  vec2 v2 = prototypeHexStyle.v2;
  vec2 v3 = prototypeHexStyle.v3;
  vec2 v4 = prototypeHexStyle.v4;
  vec2 v5 = prototypeHexStyle.v5;

  float d = 1e9;
  d = min(d, segmentDistance(p, v0, v1));
  d = min(d, segmentDistance(p, v1, v2));
  d = min(d, segmentDistance(p, v2, v3));
  d = min(d, segmentDistance(p, v3, v4));
  d = min(d, segmentDistance(p, v4, v5));
  d = min(d, segmentDistance(p, v5, v0));
  return d;
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float triangleMask(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 v0 = c - a;
  vec2 v1 = b - a;
  vec2 v2 = p - a;
  float dot00 = dot(v0, v0);
  float dot01 = dot(v0, v1);
  float dot02 = dot(v0, v2);
  float dot11 = dot(v1, v1);
  float dot12 = dot(v1, v2);
  float invDen = 1.0 / (dot00 * dot11 - dot01 * dot01);
  float u = (dot11 * dot02 - dot01 * dot12) * invDen;
  float v = (dot00 * dot12 - dot01 * dot02) * invDen;
  return step(0.0, u) * step(0.0, v) * step(u + v, 1.0);
}

float dropMask(vec2 p, vec2 center, float size) {
  vec2 q = (p - center) / size;
  q.x = abs(q.x);
  q.y -= 0.15;
  float circle = length(q - vec2(0.0, -0.25)) - 0.45;
  float cone = max(q.y + 0.55, q.x * 0.9 + q.y + 0.4);
  float d = min(circle, cone);
  return smoothstep(0.05, -0.02, d);
}

vec2 rotateAround(vec2 p, vec2 center, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  vec2 d = p - center;
  return vec2(
    d.x * c - d.y * s,
    d.x * s + d.y * c
  ) + center;
}

void main(void) {
  vec2 p = vLngLat;
  vec2 c = prototypeHexStyle.center;
  vec2 rel = p - c;

  float radiusApprox = length(prototypeHexStyle.v0 - c);
  float fadeDistance = max(1e-6, radiusApprox * prototypeHexStyle.borderFadeRatio);

  float t0; float t1; float t2; float t3; float t4; float t5;
  float d0 = segmentDistanceAndT(p, prototypeHexStyle.v0, prototypeHexStyle.v1, t0);
  float d1 = segmentDistanceAndT(p, prototypeHexStyle.v1, prototypeHexStyle.v2, t1);
  float d2 = segmentDistanceAndT(p, prototypeHexStyle.v2, prototypeHexStyle.v3, t2);
  float d3 = segmentDistanceAndT(p, prototypeHexStyle.v3, prototypeHexStyle.v4, t3);
  float d4 = segmentDistanceAndT(p, prototypeHexStyle.v4, prototypeHexStyle.v5, t4);
  float d5 = segmentDistanceAndT(p, prototypeHexStyle.v5, prototypeHexStyle.v0, t5);

  float edgeDist = d0;
  float edgeTAlong = t0;
  int edgeIndex = 0;
  if (d1 < edgeDist) { edgeDist = d1; edgeTAlong = t1; edgeIndex = 1; }
  if (d2 < edgeDist) { edgeDist = d2; edgeTAlong = t2; edgeIndex = 2; }
  if (d3 < edgeDist) { edgeDist = d3; edgeTAlong = t3; edgeIndex = 3; }
  if (d4 < edgeDist) { edgeDist = d4; edgeTAlong = t4; edgeIndex = 4; }
  if (d5 < edgeDist) { edgeDist = d5; edgeTAlong = t5; edgeIndex = 5; }

  float edgeT = smoothstep(0.0, fadeDistance, edgeDist);
  float borderAlpha = (1.0 - edgeT) * prototypeHexStyle.borderMaxAlpha;

  float edgeMask = 1.0;
  if (edgeIndex == 0) edgeMask = prototypeHexStyle.edgeMaskA.x;
  if (edgeIndex == 1) edgeMask = prototypeHexStyle.edgeMaskA.y;
  if (edgeIndex == 2) edgeMask = prototypeHexStyle.edgeMaskA.z;
  if (edgeIndex == 3) edgeMask = prototypeHexStyle.edgeMaskB.x;
  if (edgeIndex == 4) edgeMask = prototypeHexStyle.edgeMaskB.y;
  if (edgeIndex == 5) edgeMask = prototypeHexStyle.edgeMaskB.z;
  borderAlpha *= edgeMask;

  float edgeMid = 1.0 - abs(edgeTAlong - 0.5) * 2.0;
  edgeMid = clamp(edgeMid, 0.0, 1.0);
  borderAlpha *= pow(edgeMid, max(0.1, prototypeHexStyle.edgeMidPower));

  if (prototypeHexStyle.sideEnabled > 0.5) {
    vec2 dir = normalize(prototypeHexStyle.sideDir);
    float sideCoord = dot(rel, dir);
    float soft = max(1e-6, radiusApprox * prototypeHexStyle.sideSoftnessRatio);
    float sideMask = smoothstep(0.0, soft, sideCoord);
    borderAlpha *= sideMask;
  }

  vec3 borderRgb = prototypeHexStyle.borderColor;

  vec3 fillColorA = prototypeHexStyle.fillColorA;
  vec3 fillColorB = prototypeHexStyle.fillColorB;
  float fillNorm = clamp(radiusApprox > 0.0 ? length(rel) / radiusApprox : 0.0, 0.0, 1.0);
  float fillGradient =
    prototypeHexStyle.fillGradientPower > 0.0
      ? pow(fillNorm, prototypeHexStyle.fillGradientPower)
      : fillNorm;
  vec3 fillRgb = mix(fillColorA, fillColorB, fillGradient);

  if (prototypeHexStyle.fillGlossMagnitude > 0.001) {
    vec2 glossDir = normalize(prototypeHexStyle.fillGlossDir);
    float glossDot = max(0.0, dot(glossDir, normalize(rel)));
    float glossFactor = pow(glossDot, prototypeHexStyle.fillGlossPower);
    fillRgb += glossFactor * prototypeHexStyle.fillGlossMagnitude;
  }

  float noiseStrength = 0.0;
  if (prototypeHexStyle.noiseEnabled > 0.5) {
    vec2 jitter = vec2(
      hash21(p + vec2(1.3, 7.9)),
      hash21(p + vec2(9.1, 2.5))
    ) - 0.5;
    vec2 noiseGrid = fract((p + jitter * 0.8) * prototypeHexStyle.noiseDotScale);
    float dotDist = length(noiseGrid - 0.5);
    float dotMask = smoothstep(
      prototypeHexStyle.noiseDotSize,
      prototypeHexStyle.noiseDotSize + 0.08,
      dotDist
    );
    float random = hash21(p * prototypeHexStyle.noiseDotScale + vec2(5.2, 9.7));
    float dotPulse = step(prototypeHexStyle.noiseThreshold, random);
    float particle = (1.0 - dotMask) * dotPulse;
    noiseStrength = clamp(particle * prototypeHexStyle.noiseAmount, 0.0, 1.0);
    vec3 noiseRgb =
      mix(
        prototypeHexStyle.noisePaletteA,
        prototypeHexStyle.noisePaletteB,
        hash21(p * prototypeHexStyle.noiseDotScale + vec2(11.3, 4.7))
      );
    fillRgb = mix(fillRgb, noiseRgb, noiseStrength);
  }

  vec3 patternRgb = fillRgb;
  float patternMask = 0.0;

  if (prototypeHexStyle.patternKind > 0.5) {
    vec2 uv = radiusApprox > 0.0 ? rel / radiusApprox : vec2(0.0);
    vec2 uv01 = uv * 0.5 + 0.5;

    if (prototypeHexStyle.patternKind < 1.5) {
      float diag = uv01.x + uv01.y;
      float bandWidth = 1.15;
      float depthFromEdge = clamp((2.0 - diag) / bandWidth, 0.0, 1.0);
      float shadowFade = 1.0 - smoothstep(0.0, 1.0, depthFromEdge);
      float densityPhase = 1.0 - smoothstep(0.0, 0.85, depthFromEdge);

      vec2 scaled = uv01 * vec2(40.0);
      vec2 cell = floor(scaled);
      vec2 cellUv = fract(scaled);
      vec2 jitter = vec2(hash21(cell + vec2(2.1, 3.7)), hash21(cell + vec2(7.3, 1.9))) - 0.5;
      cellUv += jitter * 0.015;
      float radius = mix(0.028, 0.055, hash21(cell + vec2(5.1, 9.2)));
      radius *= mix(1.0, 3.2, depthFromEdge);
      float dist = length(cellUv - 0.5);
      float dot = smoothstep(radius, radius - 0.014, dist);
      float density = mix(0.2, 0.75, densityPhase);
      float keep = step(1.0 - density, hash21(cell + vec2(12.7, 4.6)));
      float particleMask = dot * keep;

      float fine = hash21(uv01 * 90.0);
      float coarse = hash21(uv01 * 24.0);
      float grain = mix(fine, coarse, 0.6);
      float bandMask = step(2.0 - bandWidth, diag);

      vec3 grainColor = mix(prototypeHexStyle.noisePaletteA, prototypeHexStyle.noisePaletteB, grain);
      vec3 grainBase = mix(prototypeHexStyle.fillColorA, prototypeHexStyle.fillColorB, 0.5);
      vec3 shadowBase = mix(grainBase, grainBase * vec3(0.55, 0.58, 0.62), 0.7);

      float grainStrength = mix(0.2, 0.9, particleMask) * (0.4 + 0.6 * densityPhase);
      patternRgb = mix(shadowBase, grainColor, grainStrength);
      patternMask = bandMask * shadowFade * 1.1;
    } else if (prototypeHexStyle.patternKind < 2.5) {
      float triLarge = triangleMask(uv01, vec2(0.18, 0.88), vec2(0.5, 0.22), vec2(0.82, 0.88));
      float triSmall = triangleMask(uv01, vec2(0.44, 0.7), vec2(0.6, 0.45), vec2(0.76, 0.7));
      float snowCap = triangleMask(uv01, vec2(0.44, 0.38), vec2(0.5, 0.22), vec2(0.56, 0.38));
      float ridge = smoothstep(0.4, 0.6, uv01.x);
      vec3 mountainShade = mix(fillRgb * 1.2, fillRgb * 0.6, ridge);
      float mountainMask = max(triLarge, triSmall);
      patternRgb = mix(fillRgb, mountainShade, mountainMask * 0.95);
      patternRgb = mix(patternRgb, fillRgb * 1.1, triSmall * 0.9);
      patternRgb = mix(patternRgb, vec3(1.0), snowCap * 0.85);
      patternMask = max(mountainMask, snowCap);
    } else if (prototypeHexStyle.patternKind < 3.5) {
      float diag = uv01.x + uv01.y;
      float typeSeed = hash21(prototypeHexStyle.center * 0.01 + vec2(12.7, 4.2));
      if (typeSeed < 0.5) {
        vec2 uvMount = vec2(1.0 - uv01.x, uv01.y);
        float baseY = 0.0;
        // Wide equilateral-ish triangles (apex angle ~60deg)
        float apexSmallY = 0.72;
        float halfBaseSmall = (apexSmallY - baseY) * 0.577;
        float small = triangleMask(
          uvMount,
          vec2(0.5 - halfBaseSmall, baseY),
          vec2(0.5 + halfBaseSmall, baseY),
          vec2(0.5, apexSmallY)
        );

        float apexLargeY = 0.9;
        float halfBaseLarge = (apexLargeY - baseY) * 0.577;
        float large = triangleMask(
          uvMount,
          vec2(0.5 - halfBaseLarge - 0.08, baseY),
          vec2(0.5 + halfBaseLarge + 0.08, baseY),
          vec2(0.5 + 0.05, apexLargeY)
        );

        float snowCurveSmall = apexSmallY - 0.06 + 0.03 * sin(uvMount.x * 6.0);
        float snowCurveLarge = apexLargeY - 0.08 + 0.04 * sin(uvMount.x * 5.0);
        float snowSmall = triangleMask(
          uvMount,
          vec2(0.5 - halfBaseSmall * 0.45, snowCurveSmall),
          vec2(0.5 + halfBaseSmall * 0.45, snowCurveSmall),
          vec2(0.5, apexSmallY)
        );
        float snowLarge = triangleMask(
          uvMount,
          vec2(0.5 - halfBaseLarge * 0.5 + 0.02, snowCurveLarge),
          vec2(0.5 + halfBaseLarge * 0.5 + 0.02, snowCurveLarge),
          vec2(0.5 + 0.05, apexLargeY)
        );

        float mountainMask = max(small, large);
        float sideShade = smoothstep(0.35, 0.75, uvMount.x);
        vec3 mountainBase = mix(vec3(0.5, 0.36, 0.22), vec3(0.3, 0.2, 0.14), sideShade);
        vec3 mountainColor = mix(mountainBase, vec3(0.92), max(snowSmall, snowLarge) * 0.9);
        patternRgb = mountainColor;
        patternMask = mountainMask;
      } else {
        vec3 dropColor = vec3(0.06, 0.08, 0.12);
        vec3 col = dropColor;
        float dropSum = 0.0;
        vec2 baseCenters[3];
        baseCenters[0] = vec2(0.6, 0.22);
        baseCenters[1] = vec2(0.73, 0.42);
        baseCenters[2] = vec2(0.84, 0.6);
        float baseSize[3];
        baseSize[0] = 0.18;
        baseSize[1] = 0.22;
        baseSize[2] = 0.24;

        for (int i = 0; i < 3; i++) {
          float jitterSeed = hash21(prototypeHexStyle.center * (0.13 + float(i) * 0.04) + float(i) * 5.1);
          vec2 jitter = (vec2(
            hash21(prototypeHexStyle.center + vec2(1.7 * float(i), 3.9 * float(i))),
            hash21(prototypeHexStyle.center + vec2(4.2 * float(i), 2.6 * float(i)))
          ) - 0.5) * 0.08;
          vec2 c = baseCenters[i] + jitter;
          float s = baseSize[i] * mix(0.9, 1.4, jitterSeed);

          float angle = mix(-0.4, 0.4, jitterSeed);
          vec2 rotated = rotateAround(uv01, c, angle);

          float body = dropMask(rotated, c, s);
          float rim = dropMask(rotated, c, s * 0.96) - dropMask(rotated, c, s * 0.92);
          vec2 highlightOffset = vec2(0.05, -0.04);
          float highlight = dropMask(rotated + highlightOffset, c, s * 0.42);

          col = mix(col, dropColor + vec3(0.18, 0.2, 0.26), rim * 0.7);
          col += vec3(0.6, 0.68, 0.78) * highlight * 0.55;
          dropSum = max(dropSum, body);
        }

        patternRgb = col;
        patternMask = dropSum;
      }
    } else {
      vec2 grid = fract(uv01 * vec2(5.0, 5.0));
      float triangle = step(grid.y, 1.0 - abs(grid.x - 0.5) * 2.0);
      float tree = triangle * step(0.18, grid.y);
      float jitter = hash21(floor(uv01 * vec2(5.0, 5.0)));
      float treeMask = tree * step(0.3, jitter);
      vec3 canopy = mix(fillRgb, vec3(0.1, 0.5, 0.22), 0.75);
      patternRgb = canopy;
      patternMask = treeMask;
    }
  }

  float centerFade = 1.0;
  if (prototypeHexStyle.centerFadeOuter > prototypeHexStyle.centerFadeInner) {
    float centerNorm = clamp(radiusApprox > 0.0 ? length(rel) / radiusApprox : 0.0, 0.0, 1.0);
    centerFade = smoothstep(
      prototypeHexStyle.centerFadeInner,
      prototypeHexStyle.centerFadeOuter,
      centerNorm
    );
  }
  if (prototypeHexStyle.patternKind > 0.5) {
    centerFade = 1.0;
  }
  borderAlpha *= centerFade;

  if (patternMask > 0.0) {
    if (prototypeHexStyle.patternKind < 1.5) {
      fillRgb = patternRgb;
    } else {
      fillRgb = mix(fillRgb, patternRgb, clamp(patternMask, 0.0, 1.0));
    }
  }
  float fillAlpha = prototypeHexStyle.fillAlpha * centerFade;
  if (prototypeHexStyle.patternKind > 0.5) {
    fillAlpha *= clamp(patternMask, 0.0, 1.0);
  }
  float debugFillAlpha = prototypeHexStyle.debugFillAlpha * centerFade;
  float effectiveFillAlpha = max(fillAlpha, debugFillAlpha);

  if (prototypeHexStyle.cubeEnabled > 0.5) {
    vec2 relDir = length(rel) > 0.0 ? normalize(rel) : vec2(0.0);
    vec2 faceDirs[3] = vec2[](
      vec2(0.0, 1.0),
      vec2(0.866, -0.5),
      vec2(-0.866, -0.5)
    );
    vec3 faceTints[3] = vec3[](
      vec3(1.15, 1.05, 0.9),
      vec3(0.85, 0.7, 0.55),
      vec3(0.95, 0.85, 0.65)
    );
    float weightSum = 0.0;
    vec3 tinted = vec3(0.0);
    float lineMask = 0.0;
    for (int i = 0; i < 3; i++) {
      float dotVal = max(0.0, dot(relDir, faceDirs[i]));
      weightSum += dotVal;
      tinted += faceTints[i] * dotVal;
      float perp = dot(vec2(-faceDirs[i].y, faceDirs[i].x), rel);
      float lineDist = abs(perp) / max(radiusApprox, 1e-3);
      float mask = 1.0 - smoothstep(
        prototypeHexStyle.cubeLineThickness,
        prototypeHexStyle.cubeLineThickness + 0.04,
        lineDist
      );
      lineMask = max(lineMask, mask);
    }
    if (weightSum > 0.0) {
      tinted /= weightSum;
      fillRgb = mix(fillRgb, fillRgb * tinted, clamp(prototypeHexStyle.cubeShadeBoost, 0.0, 1.0));
    }
    lineMask = clamp(lineMask, 0.0, 1.0);
    fillRgb = mix(fillRgb, prototypeHexStyle.cubeLineColor, lineMask * 0.9);
    effectiveFillAlpha = max(effectiveFillAlpha, lineMask * 0.45);
    borderAlpha = max(borderAlpha, lineMask * 0.55);
  }

  float finalAlpha = max(borderAlpha, effectiveFillAlpha);
  vec3 finalRgb = mix(fillRgb, borderRgb, borderAlpha);
  fragColor = vec4(finalRgb, finalAlpha);
}
`;

export class PrototypeHexStyleLayer extends Layer<PrototypeHexStyleLayerProps> {
  static layerName = "PrototypeHexStyleLayer";

  getShaders() {
    return {
      vs,
      fs,
      modules: [project32, prototypeHexStyleUniforms],
    };
  }

  initializeState() {
    this.setState({ model: this._createModel() });
  }

  updateState({ props, oldProps, changeFlags }: any) {
    if (changeFlags.propsChanged) {
      if (
        props.verticesLngLat !== oldProps.verticesLngLat ||
        props.centerLngLat !== oldProps.centerLngLat
      ) {
        const previousModel = (this.state as any).model as Model | null | undefined;
        previousModel?.destroy?.();
        this.setState({ model: this._createModel() });
      }
    }
  }

  finalizeState() {
    const previousModel = (this.state as any).model as Model | null | undefined;
    previousModel?.destroy?.();
  }

  draw() {
    const model = (this.state as any).model as Model | null | undefined;
    if (!model) return;

    const vertices = this.props.verticesLngLat;
    if (!vertices || vertices.length !== 6) return;

    const rawBorderColor = this.props.borderColor ?? ([239, 68, 68] as const);
    const borderColor: [number, number, number] =
      rawBorderColor.some((value) => value > 1)
        ? (rawBorderColor.map((value) => value / 255) as [number, number, number])
        : rawBorderColor;
    const borderMaxAlpha = this.props.borderMaxAlpha ?? 0.85;
    const borderFadeRatio = this.props.borderFadeRatio ?? 0.45;
    const debugFillAlpha = this.props.debugFillAlpha ?? 0.0;
    const edgeMask = this.props.edgeMask ?? ([1, 1, 1, 1, 1, 1] as const);
    const edgeMidPower = this.props.edgeMidPower ?? 2.3;

    const sideEnabled = this.props.sideEnabled ? 1 : 0;
    const sideDir = this.props.sideDirLngLat ?? ([1, 0] as const);
    const sideSoftnessRatio = this.props.sideSoftnessRatio ?? 0.22;

    const noiseEnabled = this.props.noiseEnabled ? 1 : 0;
    const noiseScale = this.props.noiseScale ?? 18.0;
    const noiseAmount = this.props.noiseAmount ?? 0.35;
    const rawNoisePaletteA = this.props.noisePaletteA ?? ([0.74, 0.70, 0.48] as const); // khaki-ish
    const rawNoisePaletteB = this.props.noisePaletteB ?? ([0.24, 0.35, 0.20] as const); // green-ish
    const noisePaletteA: [number, number, number] =
      rawNoisePaletteA.some((value) => value > 1)
        ? (rawNoisePaletteA.map((value) => value / 255) as [number, number, number])
        : rawNoisePaletteA;
    const noisePaletteB: [number, number, number] =
      rawNoisePaletteB.some((value) => value > 1)
        ? (rawNoisePaletteB.map((value) => value / 255) as [number, number, number])
        : rawNoisePaletteB;
    const centerFadeInner = this.props.centerFadeInner ?? 0.0;
    const centerFadeOuter = this.props.centerFadeOuter ?? 1.0;
    const noiseDotScale = this.props.noiseDotScale ?? 12.0;
    const noiseDotSize = this.props.noiseDotSize ?? 0.24;
    const noiseThreshold = this.props.noiseThreshold ?? 0.53;
    const fillColorA =
      this.props.fillColorA ??
      borderColor.map((value) => Math.min(value * 1.2, 1)) as [number, number, number];
    const fillColorB =
      this.props.fillColorB ??
      borderColor.map((value) => Math.min(value * 0.9 + 0.08, 1)) as [number, number, number];
    const fillAlpha = this.props.fillAlpha ?? this.props.debugFillAlpha ?? 0.12;
    const fillGradientPower = this.props.fillGradientPower ?? 1.4;
    const fillGlossDirLngLat = this.props.fillGlossDirLngLat ?? ([1, -0.5] as const);
    const fillGlossDirLength = Math.hypot(fillGlossDirLngLat[0], fillGlossDirLngLat[1]);
    const fillGlossDir: [number, number] = fillGlossDirLength
      ? [fillGlossDirLngLat[0] / fillGlossDirLength, fillGlossDirLngLat[1] / fillGlossDirLength]
      : [1, 0];
    const fillGlossMagnitude = this.props.fillGlossMagnitude ?? 0.38;
    const fillGlossPower = this.props.fillGlossPower ?? 2.8;
    const cubeEnabled = this.props.cubeEnabled ? 1 : 0;
    const cubeLineThickness = this.props.cubeLineThickness ?? 0.04;
    const rawCubeLineColor = this.props.cubeLineColor ?? ([1, 0.85, 0.48] as const);
    const cubeLineColor: [number, number, number] =
      rawCubeLineColor.some((value) => value > 1)
        ? (rawCubeLineColor.map((value) => value / 255) as [number, number, number])
        : rawCubeLineColor;
    const cubeShadeBoost = this.props.cubeShadeBoost ?? 0.38;
    const patternKind = this.props.patternKind ?? 0.0;

    const uniforms: PrototypeHexStyleUniformProps = {
      center: this.props.centerLngLat,
      v0: vertices[0],
      v1: vertices[1],
      v2: vertices[2],
      v3: vertices[3],
      v4: vertices[4],
      v5: vertices[5],
      borderColor,
      borderMaxAlpha,
      borderFadeRatio,
      debugFillAlpha,
      edgeMaskA: [edgeMask[0], edgeMask[1], edgeMask[2]],
      edgeMaskB: [edgeMask[3], edgeMask[4], edgeMask[5]],
      edgeMidPower,
      sideEnabled,
      sideDir,
      sideSoftnessRatio,
      noiseEnabled,
      noiseScale,
      noiseAmount,
      noisePaletteA,
      noisePaletteB,
      noiseDotScale,
      noiseDotSize,
      noiseThreshold,

      fillColorA,
      fillColorB,
      fillAlpha,
      fillGradientPower,
      fillGlossDir,
      fillGlossMagnitude,
      fillGlossPower,
      cubeEnabled,
      cubeLineThickness,
      cubeLineColor,
      cubeShadeBoost,
      patternKind,
      centerFadeInner,
      centerFadeOuter,
    };

    model.setParameters({
      depthTest: false,
      depthMask: false,
      cullMode: "none",
      blend: true,
      blendEquation: "add",
      blendFunc: ["src-alpha", "one-minus-src-alpha"],
    } as any);

    model.shaderInputs.setProps({ prototypeHexStyle: uniforms });
    model.draw(this.context.renderPass);
  }

  private _createModel() {
    const vertices = this.props.verticesLngLat ?? [];
    if (vertices.length !== 6) {
      return null;
    }

    const positions = new Float32Array(
      vertices.flatMap(([x, y]) => [x, y, 0])
    );
    const positions64Low = new Float32Array(positions.length);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);

    const geometry = new Geometry({
      topology: "triangle-list",
      attributes: {
        positions: { size: 3, value: positions },
        positions64Low: { size: 3, value: positions64Low },
      },
      indices: { size: 1, value: indices },
    });

    return new Model(this.context.device, {
      ...this.getShaders(),
      id: this.props.id,
      geometry,
      isInstanced: false,
    });
  }
}
