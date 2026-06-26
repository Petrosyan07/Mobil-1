import M1Journal from "@/components/m1-journal";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  return <M1Journal section="orders" initialOrderId={params.order} />;
}
