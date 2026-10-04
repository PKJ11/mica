export type VnitStudent = { roll: string; name: string; guest?: boolean };

// Names exactly as they appear on the college record (surname first).
export const VNIT_STUDENTS: VnitStudent[] = [
  { roll: "BT23CSE062", name: "GAIKWAD ARJUN AMBADASRAO" },
  { roll: "BT23CSE121", name: "SHAMAKURA HASNIKA REDDY" },
  { roll: "BT23CSE008", name: "KOSHY JOHN OOMMEN" },
  { roll: "BT23CSE074", name: "AMAN SINGH" },
  { roll: "BT23CSE063", name: "ROHIT CHIMANKAR" },
  { roll: "BT23CSE089", name: "SARANSH SHESHRAO RADE" },
  { roll: "BT23CSE077", name: "ATTULURI DIVYA MADHURI" },
  { roll: "BT23CSE009", name: "MUHAMMED NITHASH" },
  { roll: "BT23CSE056", name: "PURAM SHRAVYA" },
  { roll: "BT23CSE006", name: "BHUMIKA NILESH UJJAINKAR" },
  { roll: "BT23CSE039", name: "DAKSH RATHORE" },
  { roll: "BT23CSE015", name: "ARJUN JAISHANKAR" },
  { roll: "BT23CSE005", name: "RAJAS DARYAPURKAR" },
  { roll: "BT23CSE087", name: "JAISWAL ARYAN MANOJ" },
  { roll: "BT23CSE060", name: "BHAVITHASRI KOPURI" },
  { roll: "BT23CSE058", name: "VIPIN KUMAR" },
  { roll: "BT23CSE091", name: "SAGAR DILIP JADHAV" },
  { roll: "BT23CSE004", name: "KAVYA NAMBURI" },
  { roll: "BT23CSE113", name: "HANCHATE DHANVANSHIKUMAR NAGESHWAR" },
  { roll: "BT23CSE081", name: "VIVEK KUMAR" },
  { roll: "BT23CSE007", name: "NIHARIKA SURESH" },
  { roll: "BT23CSE105", name: "PRATHAMESH PATIL" },
  { roll: "BT23CSE076", name: "KADUMURI SAI DEVA HARSHA" },
  { roll: "BT23CSE042", name: "ARNAV LAXMIKANT MADAVI" },
  { roll: "BT23CSE031", name: "BHUKYA SRIVIDHYA" },
  { roll: "BT23CSE094", name: "SANGLE SARVAMBH KESHAV" },
];

/** Logins for people not on the class list; they share one password. */
export const VNIT_GUESTS: VnitStudent[] = [
  { roll: "kartik-vyas", name: "KARTIK VYAS", guest: true },
  { roll: "others1", name: "OTHERS1", guest: true },
  { roll: "others2", name: "OTHERS2", guest: true },
];
const GUEST_PASSWORD = "CHIN2026";

/**
 * Password = first 4 letters of the first word of the official name + last 4 characters of the roll no.
 * e.g. GAIKWAD ARJUN AMBADASRAO, BT23CSE062 -> GAIKE062
 */
export function vnitPasswordFor(s: VnitStudent): string {
  if (s.guest) return GUEST_PASSWORD;
  const first = s.name.trim().split(/\s+/)[0];
  return first.slice(0, 4) + s.roll.slice(-4);
}

export function findVnitStudent(roll: string): VnitStudent | undefined {
  const r = roll.trim().toLowerCase();
  return [...VNIT_STUDENTS, ...VNIT_GUESTS].find((s) => s.roll.toLowerCase() === r);
}
