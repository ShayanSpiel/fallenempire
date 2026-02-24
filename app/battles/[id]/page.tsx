import { redirect } from "next/navigation";

export default async function BattleRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(id ? `/battle/${id}` : "/battles");
}
