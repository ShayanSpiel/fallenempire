import { Layer, project32, type LayerProps, fp64LowPart } from "@deck.gl/core";
import type { ShaderModule } from "@luma.gl/shadertools";
import { Geometry, Model } from "@luma.gl/engine";

export type HexBorderDatum = {
  id: string;
  center: [number, number];
  vertices: [number, number][];
  color: [number, number, number];
  alpha: number;
  borderWidth: number;
  edgeMask: [number, number, number, number, number, number];
  order?: number;
};

export type HexBorderLayerProps = LayerProps & {
  data: HexBorderDatum[];
  animate?: boolean;
  animationTimeMs?: number;
  animationStepMs?: number;
  animationFadeMs?: number;
};

type HexBorderUniformProps = {
  timeMs: number;
  stepMs: number;
  fadeMs: number;
  animate: number;
};

const uniformBlock = `\
uniform hexBorderUniforms {
  float timeMs;
  float stepMs;
  float fadeMs;
  float animate;
} hexBorder;
`;

const hexBorderUniforms = {
  name: "hexBorder",
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    timeMs: "f32",
    stepMs: "f32",
    fadeMs: "f32",
    animate: "f32",
  },
} as const satisfies ShaderModule<HexBorderUniformProps>;

const vs = `\
#version 300 es
#define SHADER_NAME hex-border-layer-vertex

in vec3 positions;
in vec3 positions64Low;
in vec2 center;
in vec2 v0;
in vec2 v1;
in vec2 v2;
in vec2 v3;
in vec2 v4;
in vec2 v5;
in vec3 borderColor;
in float borderAlpha;
in float borderWidth;
in vec3 edgeMaskA;
in vec3 edgeMaskB;
in float order;

out vec2 vLngLat;
out vec2 vCenter;
out vec2 vV0;
out vec2 vV1;
out vec2 vV2;
out vec2 vV3;
out vec2 vV4;
out vec2 vV5;
out vec3 vBorderColor;
out float vBorderAlpha;
out float vBorderWidth;
out vec3 vEdgeMaskA;
out vec3 vEdgeMaskB;
out float vOrder;

void main(void) {
  vLngLat = positions.xy;
  vCenter = center;
  vV0 = v0;
  vV1 = v1;
  vV2 = v2;
  vV3 = v3;
  vV4 = v4;
  vV5 = v5;
  vBorderColor = borderColor;
  vBorderAlpha = borderAlpha;
  vBorderWidth = borderWidth;
  vEdgeMaskA = edgeMaskA;
  vEdgeMaskB = edgeMaskB;
  vOrder = order;
  gl_Position = project_position_to_clipspace(positions, positions64Low, vec3(0.));
}
`;

const fs = `\
#version 300 es
#define SHADER_NAME hex-border-layer-fragment

precision highp float;

in vec2 vLngLat;
in vec2 vCenter;
in vec2 vV0;
in vec2 vV1;
in vec2 vV2;
in vec2 vV3;
in vec2 vV4;
in vec2 vV5;
in vec3 vBorderColor;
in float vBorderAlpha;
in float vBorderWidth;
in vec3 vEdgeMaskA;
in vec3 vEdgeMaskB;
in float vOrder;

out vec4 fragColor;

float segmentDistanceAndT(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = dot(pa, ba) / dot(ba, ba);
  t = clamp(h, 0.0, 1.0);
  return length(pa - ba * t);
}

float getEdgeMask(int edgeIndex) {
  if (edgeIndex == 0) return vEdgeMaskA.x;
  if (edgeIndex == 1) return vEdgeMaskA.y;
  if (edgeIndex == 2) return vEdgeMaskA.z;
  if (edgeIndex == 3) return vEdgeMaskB.x;
  if (edgeIndex == 4) return vEdgeMaskB.y;
  return vEdgeMaskB.z;
}

void main(void) {
  float t0; float t1; float t2; float t3; float t4; float t5;
  float d0 = segmentDistanceAndT(vLngLat, vV0, vV1, t0);
  float d1 = segmentDistanceAndT(vLngLat, vV1, vV2, t1);
  float d2 = segmentDistanceAndT(vLngLat, vV2, vV3, t2);
  float d3 = segmentDistanceAndT(vLngLat, vV3, vV4, t3);
  float d4 = segmentDistanceAndT(vLngLat, vV4, vV5, t4);
  float d5 = segmentDistanceAndT(vLngLat, vV5, vV0, t5);

  float edgeDist = d0;
  int edgeIndex = 0;
  if (d1 < edgeDist) { edgeDist = d1; edgeIndex = 1; }
  if (d2 < edgeDist) { edgeDist = d2; edgeIndex = 2; }
  if (d3 < edgeDist) { edgeDist = d3; edgeIndex = 3; }
  if (d4 < edgeDist) { edgeDist = d4; edgeIndex = 4; }
  if (d5 < edgeDist) { edgeDist = d5; edgeIndex = 5; }

  float edgeMask = getEdgeMask(edgeIndex);
  if (edgeMask <= 0.01) {
    discard;
  }

  float feather = max(vBorderWidth * 0.85, 0.00001);
  float inner = max(vBorderWidth - feather, 0.0);
  float outer = vBorderWidth + feather;
  float borderMask = smoothstep(outer, inner, edgeDist);
  borderMask *= edgeMask;

  float appear = 1.0;
  if (hexBorder.animate > 0.5 && vOrder >= 0.0) {
    appear = clamp((hexBorder.timeMs - vOrder * hexBorder.stepMs) / hexBorder.fadeMs, 0.0, 1.0);
  }

  float alpha = vBorderAlpha * borderMask * appear;
  if (alpha <= 0.001) {
    discard;
  }

  fragColor = vec4(vBorderColor, alpha);
}
`;

export class HexBorderLayer extends Layer<HexBorderLayerProps> {
  static layerName = "HexBorderLayer";

  getShaders() {
    return {
      vs,
      fs,
      modules: [project32, hexBorderUniforms],
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

    const uniforms: HexBorderUniformProps = {
      timeMs: this.props.animationTimeMs ?? 0,
      stepMs: this.props.animationStepMs ?? 150,
      fadeMs: this.props.animationFadeMs ?? 240,
      animate: this.props.animate ? 1 : 0,
    };

    model.setParameters({
      depthTest: false,
      depthMask: false,
      cullMode: "none",
      blend: true,
      blendEquation: "add",
      blendFunc: ["src-alpha", "one-minus-src-alpha"],
    } as any);

    model.shaderInputs.setProps({ hexBorder: uniforms });
    model.draw(this.context.renderPass);
  }

  private _createModel(data: HexBorderDatum[]) {
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
    const widths = new Float32Array(totalVertices);
    const edgeMaskA = new Float32Array(totalVertices * 3);
    const edgeMaskB = new Float32Array(totalVertices * 3);
    const orders = new Float32Array(totalVertices);

    let vertexOffset = 0;
    for (const datum of validData) {
      const color = normalizeColor(datum.color);
      const alpha = normalizeAlpha(datum.alpha);
      const order = Number.isFinite(datum.order ?? -1) ? (datum.order ?? -1) : -1;
      const [centerX, centerY] = datum.center;
      const [v0, v1, v2, v3, v4, v5] = datum.vertices;
      const mask = datum.edgeMask ?? [1, 1, 1, 1, 1, 1];

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
          widths[vertexOffset] = datum.borderWidth;

          const maskIndex = vertexOffset * 3;
          edgeMaskA[maskIndex] = mask[0];
          edgeMaskA[maskIndex + 1] = mask[1];
          edgeMaskA[maskIndex + 2] = mask[2];
          edgeMaskB[maskIndex] = mask[3];
          edgeMaskB[maskIndex + 1] = mask[4];
          edgeMaskB[maskIndex + 2] = mask[5];

          orders[vertexOffset] = order;
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
        borderColor: { size: 3, value: colors },
        borderAlpha: { size: 1, value: alphas },
        borderWidth: { size: 1, value: widths },
        edgeMaskA: { size: 3, value: edgeMaskA },
        edgeMaskB: { size: 3, value: edgeMaskB },
        order: { size: 1, value: orders },
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
