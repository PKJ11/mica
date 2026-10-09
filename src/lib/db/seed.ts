import { VNIT_GUESTS, VNIT_STUDENTS } from "@/data/vnitStudents";
import { seedCatalogue } from "./catalogue";

type Driver = { query(text: string, params?: unknown[]): Promise<unknown[]> };

export const VNIT_INSTITUTION = "vnit";
export const VNIT_COHORT = "vnit-btech-cse-2023";
/** Staff accounts on the VNIT roster. Everyone else is a student. */
const VNIT_ADMINS = new Set(["kartik-vyas"]);

export function vnitUserId(roll: string): string {
  return `${VNIT_INSTITUTION}:${roll.toLowerCase()}`;
}

/**
 * Keeps the database in step with the roster in src/data/vnitStudents.ts (until admin upload, AD-2, exists)
 * and with the content catalogue in src/data/catalogue/vnit.json.
 * Idempotent: runs on every cold start.
 */
export async function seed(db: Driver) {
  await db.query(`INSERT INTO institutions (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    VNIT_INSTITUTION,
    "VNIT Nagpur",
  ]);
  await db.query(
    `INSERT INTO cohorts (id, institution_id, name, course, batch, year) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [VNIT_COHORT, VNIT_INSTITUTION, "VNIT B.Tech CSE 2023 · 2026–27", "B.Tech CSE", "2023", "2026–27"],
  );

  const roster = [...VNIT_STUDENTS, ...VNIT_GUESTS];
  const values: unknown[] = [];
  const rows = roster.map((s, i) => {
    const role = VNIT_ADMINS.has(s.roll) ? "admin" : "student";
    values.push(vnitUserId(s.roll), VNIT_INSTITUTION, s.roll, s.name, role, Boolean(s.guest));
    const o = i * 6;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`;
  });
  await db.query(
    `INSERT INTO users (id, institution_id, roll, name, role, guest) VALUES ${rows.join(", ")}
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    values,
  );
  await db.query(
    `INSERT INTO enrolments (user_id, cohort_id, role)
     SELECT id, $1, CASE WHEN role = 'student' THEN 'student' ELSE 'instructor' END FROM users WHERE institution_id = $2
     ON CONFLICT DO NOTHING`,
    [VNIT_COHORT, VNIT_INSTITUTION],
  );
  await seedCatalogue(db, VNIT_COHORT);
}
