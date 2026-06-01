import { redirect } from "next/navigation";

export default async function BankTellersRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/banks/${id}`);
}
