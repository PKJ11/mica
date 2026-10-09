import catalogue from "@/data/catalogue/vnit.json";
import { ACTIVITIES } from "@/lib/activities";

type Driver = { query(text: string, params?: unknown[]): Promise<unknown[]> };

type CatalogueQuestion = {
  id: string;
  chapter: string | null;
  chapterSource: string | null;
  kind: string;
  type: string;
  text: string;
  options: string[];
  correct: string[];
  explanation: string | null;
};

/** One multi-row INSERT … ON CONFLICT; `rows` are arrays in `cols` order. */
async function upsert(db: Driver, table: string, cols: string[], key: string[], rows: unknown[][]) {
  if (!rows.length) return;
  const params: unknown[] = [];
  const tuples = rows.map((r) => `(${r.map((v) => (params.push(v), `$${params.length}`)).join(", ")})`);
  const update = cols.filter((c) => !key.includes(c)).map((c) => `${c} = EXCLUDED.${c}`);
  await db.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")}
     ON CONFLICT (${key.join(", ")}) DO ${update.length ? `UPDATE SET ${update.join(", ")}` : "NOTHING"}`,
    params,
  );
}

/**
 * Loads src/data/catalogue/vnit.json (built by scripts/build-catalogue.mjs) into the catalogue tables.
 * Idempotent. Chapters and elements no longer in the file are marked retired, never deleted.
 */
export async function seedCatalogue(db: Driver, cohortId: string) {
  const modules = catalogue.modules;
  await upsert(
    db,
    "modules",
    ["id", "institution_id", "title", "type", "position", "version", "updated_at"],
    ["id"],
    modules.map((m) => [m.id, catalogue.institution, ACTIVITIES[m.id]?.title ?? m.id, m.type, m.position, m.version, new Date()]),
  );
  await upsert(
    db,
    "chapters",
    ["module_id", "id", "title", "kind", "position", "retired"],
    ["module_id", "id"],
    modules.flatMap((m) => m.chapters.map((c) => [m.id, c.id, c.title, c.kind, c.position, false])),
  );
  await upsert(
    db,
    "elements",
    ["module_id", "id", "chapter_id", "type", "title", "position", "version", "data", "retired"],
    ["module_id", "id"],
    modules.flatMap((m) =>
      (m.questions as CatalogueQuestion[]).map((q, k) => [
        m.id,
        q.id,
        q.chapter,
        q.kind,
        q.text.slice(0, 200),
        k + 1,
        m.version,
        JSON.stringify({
          question_type: q.type,
          text: q.text,
          options: q.options,
          correct: q.correct,
          explanation: q.explanation,
          chapter_source: q.chapterSource,
        }),
        false,
      ]),
    ),
  );

  // Retire whatever the current file no longer lists.
  const ids = modules.map((m) => m.id);
  const chapterKeys = modules.flatMap((m) => m.chapters.map((c) => `${m.id}/${c.id}`));
  const elementKeys = modules.flatMap((m) => m.questions.map((q) => `${m.id}/${q.id}`));
  await db.query(
    `UPDATE chapters SET retired = true WHERE module_id = ANY($1) AND NOT (module_id || '/' || id = ANY($2))`,
    [ids, chapterKeys],
  );
  await db.query(
    `UPDATE elements SET retired = true WHERE module_id = ANY($1) AND NOT (module_id || '/' || id = ANY($2))`,
    [ids, elementKeys],
  );

  // Every VNIT item is assigned to the VNIT cohort for now.
  await upsert(db, "assignments", ["cohort_id", "module_id"], ["cohort_id", "module_id"], ids.map((id) => [cohortId, id]));
}
