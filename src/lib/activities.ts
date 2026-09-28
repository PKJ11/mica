export type Activity = {
  slug: string;
  file: string;
  title: string;
  subtitle: string;
  tag: string;
  /** Course the activity belongs to; used for the viewer's Back link. Defaults to ABAMDL. */
  course?: "abamdl" | "genaillm";
  /** Not shown to students yet; its URL returns 404. */
  hidden?: boolean;
};

export const ACTIVITIES: Record<string, Activity> = {
  "session1-activity": {
    slug: "session1-activity",
    file: "session1_activity.html",
    title: "Practice: the analytics continuum",
    subtitle: "Gut feel, research, analysis, machine learning",
    tag: "Session 1",
  },
  "abadl-session1-deck": {
    slug: "abadl-session1-deck",
    file: "ABADL_Session_1_Deck_Gut, Data & Machines.html",
    title: "Gut, Data & Machines",
    subtitle: "How better business decisions are made",
    tag: "Session 1 Deck",
  },
  "abadl-session2-deck": {
    slug: "abadl-session2-deck",
    file: "ABADL_Session_2_Converting Business Problem to Analytical Solution.html",
    title: "Converting Business Problem to an Analytical Solution",
    subtitle: "A walk through the CRISP-DM model",
    tag: "Session 2 Deck",
  },
  "session1-zillow": {
    slug: "session1-zillow",
    file: "The Zillow Story.pdf",
    title: "The Zillow Story",
    subtitle: "How Zillow put a price on every American home, and then paid for it",
    tag: "Reading · PDF",
  },
  "crisp-dm-1": {
    slug: "crisp-dm-1",
    file: "index_1.html",
    title: "Case 1 · Swiggy",
    subtitle: "Why is my food late?",
    tag: "Delivery times",
  },
  "crisp-dm-2": {
    slug: "crisp-dm-2",
    file: "index_2.html",
    title: "Case 2 · Amul",
    subtitle: "How much milk should go out tonight?",
    tag: "Demand forecasting",
  },
  "crisp-dm-3": {
    slug: "crisp-dm-3",
    file: "index_3.html",
    title: "Case 3 · IDFC FIRST Bank",
    subtitle: "Who may miss next month’s EMI?",
    tag: "Loan repayments",
  },
  "crisp-dm-4": {
    slug: "crisp-dm-4",
    file: "index_4.html",
    title: "Case 4 · Godrej",
    subtitle: "Where should the new cooler launch first?",
    tag: "Appliance launch",
  },

  // ---------- GENAILLM (files live in content/Genaiml) ----------
  "genai-session1": {
    slug: "genai-session1",
    file: "Genaiml/Session 1_ Gen AI & LLMs for Marketing.html",
    title: "Gen AI & LLMs for Marketing",
    subtitle: "The plan, and why Gen AI matters",
    tag: "Session 1 Deck",
    course: "genaillm",
  },
  "genai-session2": {
    slug: "genai-session2",
    file: "Genaiml/Session 2 Anatomy of Applications & Workflow Design.html",
    title: "Anatomy of Applications & Workflow Design",
    subtitle: "From a prompt to a working app",
    tag: "Session 2 Deck",
    course: "genaillm",
  },
  "genai-software-design": {
    slug: "genai-software-design",
    file: "Genaiml/Fundamentals_of_Software_Application_Design.pdf",
    title: "Fundamentals of Software Application Design",
    subtitle: "Concept note",
    tag: "Reading · PDF",
    course: "genaillm",
  },
  "genai-ai-spectrum": {
    slug: "genai-ai-spectrum",
    file: "Genaiml/The AI Spectrum_ Fundamentals of Agentic AI.html",
    title: "The AI Spectrum",
    subtitle: "Fundamentals of agentic AI: six rounds from “what is an agent?” to how much freedom to give one.",
    tag: "Interactive",
    course: "genaillm",
    hidden: true,
  },
  "genai-claude-build-kit": {
    slug: "genai-claude-build-kit",
    file: "Genaiml/The Claude Build Kit_ Building Apps and AI Workflows with Claude.html",
    title: "The Claude Build Kit",
    subtitle: "Eight rounds on how to prompt, brief, brand, test and refine so Claude builds what you want.",
    tag: "Session 2 Activity",
    course: "genaillm",
  },
  "genai-sipoc-workbench": {
    slug: "genai-sipoc-workbench",
    file: "Genaiml/SIPOC Workbench_ Multi-agent marketing.html",
    title: "SIPOC Workbench",
    subtitle: "Map a multi-agent marketing workflow before you build it, then download the worksheet as a PDF.",
    tag: "Workbench",
    course: "genaillm",
    hidden: true,
  },
  "genai-flyer-studio": {
    slug: "genai-flyer-studio",
    file: "Genaiml/Flyer Studio.html",
    title: "Flyer Studio",
    subtitle: "Upload a template, describe the flyer, and choose from 3 to 5 options.",
    tag: "Studio",
    course: "genaillm",
    hidden: true,
  },
};

export const CRISP_DM_CASES = ["crisp-dm-1", "crisp-dm-2", "crisp-dm-3", "crisp-dm-4"].map(
  (s) => ACTIVITIES[s],
);

export const GENAI_SESSION_1 = ["genai-session1", "genai-software-design"].map((s) => ACTIVITIES[s]);
export const GENAI_SESSION_2 = ["genai-session2", "genai-claude-build-kit"].map((s) => ACTIVITIES[s]);
