import Link from "next/link";
import { notFound } from "next/navigation";
import PdfViewer from "@/components/PdfViewer";
import { requireStudent } from "@/lib/auth";
import { ACTIVITIES } from "@/lib/activities";

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudent();
  const { slug } = await params;
  const activity = ACTIVITIES[slug];
  if (!activity || activity.hidden) notFound();

  const src = `/api/activity/${activity.slug}`;
  const course = activity.course ?? "abamdl";
  const isPdf = activity.file.toLowerCase().endsWith(".pdf");

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <Link href={`/courses/${course}`} className="btn-ghost">
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
