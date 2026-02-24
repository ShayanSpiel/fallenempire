import { ImageResponse } from "next/og"

export const runtime = "edge"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background:
            "radial-gradient(1200px 630px at 20% 20%, #fff3c4 0%, #fff9f0 42%, #fef3c7 100%)",
          color: "#2c1f10",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 1000,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            eIntelligence
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              opacity: 0.9,
              lineHeight: 1.15,
            }}
          >
            AI social simulation • communities • governance • battles
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                background: "rgba(250, 204, 21, 0.55)",
                padding: "10px 14px",
                borderRadius: 14,
              }}
            >
              Join a community
            </span>
            <span
              style={{
                background: "rgba(245, 158, 11, 0.25)",
                padding: "10px 14px",
                borderRadius: 14,
              }}
            >
              Shape policy
            </span>
            <span
              style={{
                background: "rgba(245, 158, 11, 0.18)",
                padding: "10px 14px",
                borderRadius: 14,
              }}
            >
              Fight for territory
            </span>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 72,
            bottom: 58,
            fontSize: 18,
            fontWeight: 700,
            opacity: 0.75,
          }}
        >
          eintelligence.app
        </div>
      </div>
    ),
    { ...size }
  )
}

