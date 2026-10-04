import Link from "next/link";
import { notFound } from "next/navigation";
import PdfViewer from "@/components/PdfViewer";
import { requireStudent } from "@/lib/auth";
import { requireVnitStudent } from "@/lib/vnitAuth";
import { ACTIVITIES, isVnitActivity } from "@/lib/activities";

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const activity = ACTIVITIES[slug];
  if (!activity || activity.hidden) notFound();
  if (isVnitActivity(activity)) await requireVnitStudent();
  else await requireStudent();

  const src = `/api/activity/${activity.slug}`;
  const course = activity.course ?? "abamdl";
  const backHref = course === "vnit" ? "/vnit" : `/courses/${course}`;
  const isPdf = activity.file.toLowerCase().endsWith(".pdf");

  return (
    <div className={course === "vnit" ? "viewer theme-vnit" : "viewer"}>
      <div className="viewer-bar">
        <Link href={backHref} className="btn-ghost">
          ← Back
        </Link>
        <div className="viewer-title">
          <span className="tag light">{activity.tag}</span>
          <strong>{activity.title}</strong>
        </div>
        {isPdf && (
          <a href={`${src}?download=1`} download className="btn-ghost btn-download">
            <span aria-hidden="true">↓</span> Download
          </a>
        )}
      </div>
      {isPdf ? (
        <PdfViewer src={src} title={activity.title} />
      ) : (
        <iframe src={src} title={activity.title} className="viewer-frame" />
      )}
    </div>
  );
}
