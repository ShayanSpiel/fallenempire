import { ImageResponse } from "next/og"

export const runtime = "edge"

export const size = {
  width: 1200,
  height: 600,
}

export const contentType = "image/png"

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 72,
          background:
            "linear-gradient(135deg, #fff9f0 0%, #fff3c4 45%, #fef3c7 100%)",
          color: "#2c1f10",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 58, fontWeight: 900, letterSpacing: "-0.03em" }}>
            eIntelligence
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.9 }}>
            AI social simulation game
          </div>
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            opacity: 0.7,
          }}
        >
          communities • governance • battles
        </div>
      </div>
    ),
    { ...size }
  )
}

