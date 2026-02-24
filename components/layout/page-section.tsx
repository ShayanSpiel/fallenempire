import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageSectionProps = {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
  sidebarPlacement?: "left" | "right";
  noGap?: boolean;
};

export function PageSection({
  children,
  sidebar,
  className,
  sidebarPlacement = "left",
  noGap = false,
}: PageSectionProps) {
  const hasSidebar = Boolean(sidebar);

  return (
    <section
      className={cn(
        "w-full pt-6 lg:pt-8 pb-[var(--layout-vertical-padding)]",
        className
      )}
    >
      <div className="mx-auto w-full px-[var(--layout-horizontal-padding)]" style={{ maxWidth: "var(--layout-max-width)" }}>
        {hasSidebar ? (
          <ResponsiveGrid sidebarPlacement={sidebarPlacement} sidebar={sidebar}>
            {children}
          </ResponsiveGrid>
        ) : (
          <div className={cn("flex flex-col", !noGap && "gap-[var(--layout-stack-gap)]")}>{children}</div>
        )}
      </div>
    </section>
  );
}

function ResponsiveGrid({
  sidebarPlacement,
  sidebar,
  children,
}: {
  sidebarPlacement: "left" | "right";
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const gridStyle: CSSProperties = {
    columnGap: "var(--layout-gap)",
    rowGap: "var(--layout-stack-gap)",
    gridTemplateColumns:
      sidebarPlacement === "left"
        ? `minmax(0, var(--layout-sidebar-width)) minmax(0, 1fr)`
        : `minmax(0, 1fr) minmax(0, var(--layout-sidebar-width))`,
  };

  const sidebarNode = <div>{sidebar}</div>;
  const contentNode = <div className="flex flex-col gap-[var(--layout-stack-gap)]">{children}</div>;

  return (
    <div className="flex flex-col gap-[var(--layout-stack-gap)] lg:grid" style={gridStyle}>
      {sidebarPlacement === "left" ? (
        <>
          <div className="order-2 lg:order-1">{sidebarNode}</div>
          <div className="order-1 lg:order-2">{contentNode}</div>
        </>
      ) : (
        <>
          <div className="order-2 lg:order-2">{sidebarNode}</div>
          <div className="order-1 lg:order-1">{contentNode}</div>
        </>
      )}
    </div>
  );
}
