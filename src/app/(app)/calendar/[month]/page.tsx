import MonthView from "@/components/MonthView";

export default async function MonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  return <MonthView monthKey={month} />;
}
