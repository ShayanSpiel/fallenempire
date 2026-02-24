import type { MDXComponents } from "mdx/types";
import {
  Callout,
  StatBlock,
  FeatureCard,
  Tabs,
  ComparisonTable,
  ProgressBar,
  Badge,
  Steps,
  Step,
} from "@/components/wiki/mdx-components";

// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including components from
// other libraries.

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Custom wiki components
    Callout,
    StatBlock,
    FeatureCard,
    Tabs,
    ComparisonTable,
    ProgressBar,
    Badge,
    Steps,
    Step,
    // Default HTML element overrides for better styling
    h1: ({ children }) => (
      <h1 className="mb-6 mt-8 text-4xl font-bold tracking-tight text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-4 mt-8 text-3xl font-bold tracking-tight text-foreground border-b border-border pb-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-3 mt-6 text-2xl font-semibold text-foreground">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 mt-4 text-xl font-semibold text-foreground">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="mb-4 leading-7 text-muted-foreground">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 ml-6 list-disc space-y-2 text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 ml-6 list-decimal space-y-2 text-muted-foreground">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-primary/30 bg-muted/30 p-4 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted p-4">
        {children}
      </pre>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="my-6 w-full overflow-x-auto">
        <table className="w-full border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border bg-muted p-3 text-left text-sm font-bold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border p-3 text-sm text-muted-foreground">
        {children}
      </td>
    ),
    hr: () => <hr className="my-8 border-border" />,
    ...components,
  };
}
