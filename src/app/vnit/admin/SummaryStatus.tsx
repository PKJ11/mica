import { fmtDateTime } from "@/lib/format";
import { summaryState } from "@/lib/summaries";
import { refreshNow } from "./actions";

/** "Figures updated …" line with a refresh button, shown on every staff screen that reads summaries. */
export default async function SummaryStatus({ back }: { back: string }) {
  const st = await summaryState();
  return (
    <form action={refreshNow} className="summary-status">
      <input type="hidden" name="back" value={back} />
      <span className="muted small">
        {st?.refreshed_at ? `Figures updated ${fmtDateTime(st.refreshed_at)} IST` : "Figures not built yet"} · refreshed at
        least every 15 minutes
      </span>
      <button type="submit" className="btn-small">
        Refresh now
      </button>
    </form>
  );
}
