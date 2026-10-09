import { Suspense } from "react";
import type { Filters } from "@/lib/analytics/filters";
import FilterBar from "./FilterBar";
import SummaryStatus from "./SummaryStatus";

/** Page title, the cohort and period filters, and how fresh the figures are. */
export default function StaffHeader({
  title,
  filters,
  back,
  children,
}: {
  title: string;
  filters: Filters;
  back: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="staff-header">
      {children}
      <h1 className="page-title">{title}</h1>
      <Suspense>
        <FilterBar
          cohorts={filters.cohorts}
          cohortId={filters.cohortId}
          range={filters.range}
          from={filters.from}
          to={filters.to}
          label={filters.label}
        />
      </Suspense>
      <SummaryStatus back={back} />
    </header>
  );
}
