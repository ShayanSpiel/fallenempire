import { Layer, project32, type LayerProps, fp64LowPart } from "@deck.gl/core";
import type { ShaderModule } from "@luma.gl/shadertools";
import { Geometry, Model } from "@luma.gl/engine";

export type HexCapitalRingDatum = {
  id: string;
  center: [number, number];
  vertices: [number, number][];
  color: [number, number, number];
  alpha: number;
  ringRadius: number;
  ringWidth: number;
  feather: number;
};

export type HexCapitalRingLayerProps = LayerProps & {
  data: HexCapitalRingDatum[];
};

type HexCapitalRingUniformProps = Record<string, never>;

const hexCapitalRingUniforms = {
  name: "hexCapitalRing",
  vs: "",
  fs: "",
  uniformTypes: {},
} as const satisfies ShaderModule<HexCapitalRingUniformProps>;

const vs = `\
#version 300 es
#define SHADER_NAME hex-capital-ring-layer-vertex

in vec3 positions;
in vec3 positions64Low;
in vec2 center;
in vec2 v0;
in vec2 v1;
in vec2 v2;
in vec2 v3;
in vec2 v4;
in vec2 v5;
in vec3 ringColor;
in float ringAlpha;
in float ringRadius;
in float ringWidth;
in float ringFeather;

out vec2 vLngLat;
out vec2 vCenter;
out vec2 vV0;
out vec2 vV1;
out vec2 vV2;
out vec2 vV3;
out vec2 vV4;
out vec2 vV5;
out vec3 vRingColor;
out float vRingAlpha;
out float vRingRadius;
out float vRingWidth;
out float vRingFeather;

void main(void) {
  vLngLat = positions.xy;
  vCenter = center;
  vV0 = v0;
  vV1 = v1;
  vV2 = v2;
  vV3 = v3;
  vV4 = v4;
  vV5 = v5;
  vRingColor = ringColor;
  vRingAlpha = ringAlpha;
  vRingRadius = ringRadius;
  vRingWidth = ringWidth;
  vRingFeather = ringFeather;
  gl_Position = project_position_to_clipspace(positions, positions64Low, vec3(0.));
}
`;

const fs = `\
#version 300 es
#define SHADER_NAME hex-capital-ring-layer-fragment

precision highp float;

in vec2 vLngLat;
in vec2 vCenter;
in vec2 vV0;
in vec2 vV1;
in vec2 vV2;
in vec2 vV3;
in vec2 vV4;
in vec2 vV5;
in vec3 vRingColor;
in float vRingAlpha;
in float vRingRadius;
in float vRingWidth;
in float vRingFeather;

out vec4 fragColor;

void main(void) {
  float lonScale = max(0.15, cos(radians(vCenter.y)));
  vec2 d = vec2((vLngLat.x - vCenter.x) * lonScale, (vLngLat.y - vCenter.y));
  float dist = length(d);

  float radius = max(vRingRadius, 0.00001);
  float width = clamp(vRingWidth, 0.00001, radius);
  float feather = max(vRingFeather, 0.00001);

  float inner = max(0.0, radius - width);
  float outer = radius;

  float outerMask = smoothstep(outer + feather, outer - feather, dist);
  float innerMask = smoothstep(inner - feather, inner + feather, dist);
  float bandMask = outerMask * innerMask;

  float fadeInward = clamp((dist - inner) / max(width, 0.00001), 0.0, 1.0);
  float ringMask = bandMask * pow(fadeInward, 0.8);

  float alpha = vRingAlpha * ringMask;
  if (alpha <= 0.001) {
    discard;
  }

  fragColor = vec4(vRingColor, alpha);
}
`;

export class HexCapitalRingLayer extends Layer<HexCapitalRingLayerProps> {
  static layerName = "HexCapitalRingLayer";

  getShaders() {
    return {
      vs,
      fs,
      modules: [project32, hexCapitalRingUniforms],
    };
  }

  initializeState() {
    this.setState({ model: this._createModel(this.props.data) });
  }

  updateState({ props, oldProps, changeFlags }: any) {
    if (changeFlags.dataChanged || props.data !== oldProps.data) {
      const previousModel = (this.state as any).model as Model | null | undefined;
      previousModel?.destroy?.();
      this.setState({ model: this._createModel(props.data) });
    }
  }

  finalizeState() {
    const previousModel = (this.state as any).model as Model | null | undefined;
    previousModel?.destroy?.();
  }

  draw() {
    const model = (this.state as any).model as Model | null | undefined;
    if (!model) return;

    model.setParameters({
      depthTest: false,
      depthMask: false,
      cullMode: "none",
      blend: true,
      blendEquation: "add",
      blendFunc: ["src-alpha", "one-minus-src-alpha"],
    } as any);

    model.draw(this.context.renderPass);
  }

  private _createModel(data: HexCapitalRingDatum[]) {
    if (!data?.length) return null;

    const validData = data.filter((datum) => datum.vertices?.length === 6);
    if (!validData.length) return null;

    const verticesPerHex = 18;
    const totalVertices = validData.length * verticesPerHex;

    const positions = new Float32Array(totalVertices * 3);
    const positions64Low = new Float32Array(totalVertices * 3);
    const centers = new Float32Array(totalVertices * 2);
    const v0s = new Float32Array(totalVertices * 2);
    const v1s = new Float32Array(totalVertices * 2);
    const v2s = new Float32Array(totalVertices * 2);
    const v3s = new Float32Array(totalVertices * 2);
    const v4s = new Float32Array(totalVertices * 2);
    const v5s = new Float32Array(totalVertices * 2);
    const colors = new Float32Array(totalVertices * 3);
    const alphas = new Float32Array(totalVertices);
    const radii = new Float32Array(totalVertices);
    const ringWidths = new Float32Array(totalVertices);
    const feathers = new Float32Array(totalVertices);

    let vertexOffset = 0;
    for (const datum of validData) {
      const color = normalizeColor(datum.color);
      const alpha = normalizeAlpha(datum.alpha);
      const radius = Number.isFinite(datum.ringRadius) ? datum.ringRadius : 0.01;
      const ringWidth = Number.isFinite(datum.ringWidth) ? datum.ringWidth : radius * 0.1;
      const feather = Number.isFinite(datum.feather) ? datum.feather : ringWidth * 0.6;
      const [centerX, centerY] = datum.center;
      const [v0, v1, v2, v3, v4, v5] = datum.vertices;

      const triangles: [number, number][][] = [
        [datum.center, v0, v1],
        [datum.center, v1, v2],
        [datum.center, v2, v3],
        [datum.center, v3, v4],
        [datum.center, v4, v5],
        [datum.center, v5, v0],
      ];

      for (const triangle of triangles) {
        for (const vertex of triangle) {
          const posIndex = vertexOffset * 3;
          positions[posIndex] = vertex[0];
          positions[posIndex + 1] = vertex[1];
          positions[posIndex + 2] = 0;
          positions64Low[posIndex] = fp64LowPart(vertex[0]);
          positions64Low[posIndex + 1] = fp64LowPart(vertex[1]);
          positions64Low[posIndex + 2] = 0;

          const centerIndex = vertexOffset * 2;
          centers[centerIndex] = centerX;
          centers[centerIndex + 1] = centerY;

          v0s[centerIndex] = v0[0];
          v0s[centerIndex + 1] = v0[1];
          v1s[centerIndex] = v1[0];
          v1s[centerIndex + 1] = v1[1];
          v2s[centerIndex] = v2[0];
          v2s[centerIndex + 1] = v2[1];
          v3s[centerIndex] = v3[0];
          v3s[centerIndex + 1] = v3[1];
          v4s[centerIndex] = v4[0];
          v4s[centerIndex + 1] = v4[1];
          v5s[centerIndex] = v5[0];
          v5s[centerIndex + 1] = v5[1];

          const colorIndex = vertexOffset * 3;
          colors[colorIndex] = color[0];
          colors[colorIndex + 1] = color[1];
          colors[colorIndex + 2] = color[2];

          alphas[vertexOffset] = alpha;
          radii[vertexOffset] = radius;
          ringWidths[vertexOffset] = ringWidth;
          feathers[vertexOffset] = feather;

          vertexOffset += 1;
        }
      }
    }

    const geometry = new Geometry({
      topology: "triangle-list",
      attributes: {
        positions: { size: 3, value: positions },
        positions64Low: { size: 3, value: positions64Low },
        center: { size: 2, value: centers },
        v0: { size: 2, value: v0s },
        v1: { size: 2, value: v1s },
        v2: { size: 2, value: v2s },
        v3: { size: 2, value: v3s },
        v4: { size: 2, value: v4s },
        v5: { size: 2, value: v5s },
        ringColor: { size: 3, value: colors },
        ringAlpha: { size: 1, value: alphas },
        ringRadius: { size: 1, value: radii },
        ringWidth: { size: 1, value: ringWidths },
        ringFeather: { size: 1, value: feathers },
      },
    });

    return new Model(this.context.device, {
      ...this.getShaders(),
      id: this.props.id,
      geometry,
      isInstanced: false,
    });
  }
}

function normalizeColor(
  raw: [number, number, number]
): [number, number, number] {
  if (raw.some((value) => value > 1)) {
    return [raw[0] / 255, raw[1] / 255, raw[2] / 255];
  }
  return raw;
}

function normalizeAlpha(value: number) {
  if (Number.isNaN(value)) return 1;
  return value > 1 ? value / 255 : value;
}
