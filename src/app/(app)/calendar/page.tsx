import YearCalendar from "@/components/YearCalendar";

export default function CalendarPage() {
  return <YearCalendar initialYear={new Date().getFullYear()} />;
}
