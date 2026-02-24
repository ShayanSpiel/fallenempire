"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCommunityPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Designation is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/community/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc }),
      });

      if (!response.ok) {
        const message = await response.text();
        setError(message || "Failed to create community");
        return;
      }

      const data = await response.json();
      const communitySlug = data?.slug ?? data?.id;
      if (!communitySlug) {
        setError("Unexpected response format");
        return;
      }
      router.push(`/community/${communitySlug}`);
    } catch (creationError) {
      console.error("Community creation failed", creationError);
      setError("Internal error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <form
        onSubmit={handleCreate}
        className="w-full max-w-md border border-border bg-card p-8 rounded-lg"
      >
        <h1 className="mb-6 text-center text-2xl font-bold tracking-wide text-foreground">
          Create Community
        </h1>

        <div className="space-y-4">
          <label className="block text-xs uppercase text-foreground/70">
            Designation (Name)
            <input
              className="mt-1 w-full border border-border bg-background text-foreground placeholder:text-muted-foreground p-2 rounded focus:border-ring focus:ring-1 focus:outline-none"
              placeholder="e.g. THE ARCHITECTS"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={loading}
            />
          </label>

          <label className="block text-xs uppercase text-foreground/70">
            Manifesto (Description)
            <textarea
              className="mt-1 h-24 w-full border border-border bg-background text-foreground placeholder:text-muted-foreground p-2 rounded focus:border-ring focus:ring-1 focus:outline-none"
              placeholder="Define the purpose..."
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              disabled={loading}
            />
          </label>

          {error && <p className="text-xs uppercase text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-primary text-primary-foreground py-3 font-bold uppercase rounded transition-all hover:bg-primary/80 disabled:opacity-50"
          >
            {loading ? "COMPILING..." : "ESTABLISH LINK"}
          </button>
        </div>
      </form>
    </div>
  );
}
