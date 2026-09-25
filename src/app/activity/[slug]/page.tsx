import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { ACTIVITIES } from "@/lib/activities";

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStudent();
  const { slug } = await params;
  const activity = ACTIVITIES[slug];
  if (!activity) notFound();

  const src = `/api/activity/${activity.slug}`;

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <Link href="/courses/abamdl" className="btn-ghost">
          ← Back
        </Link>
        <div className="viewer-title">
          <span className="tag light">{activity.tag}</span>
          <strong>{activity.title}</strong>
        </div>
        <a href={src} target="_blank" rel="noreferrer" className="btn-ghost">
          Full screen ↗
        </a>
      </div>
      <iframe src={src} title={activity.title} className="viewer-frame" />
    </div>
  );
}
