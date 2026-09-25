export type Activity = {
  slug: string;
  file: string;
  title: string;
  subtitle: string;
  tag: string;
};

export const ACTIVITIES: Record<string, Activity> = {
  "session1-activity": {
    slug: "session1-activity",
    file: "session1_activity.html",
    title: "Practice: the analytics continuum",
    subtitle: "Gut feel, research, analysis, machine learning",
    tag: "Session 1",
  },
  "session1-zillow": {
    slug: "session1-zillow",
    file: "The Zillow Story.pdf",
    title: "The Zillow Story",
    subtitle: "Session 1 case reading",
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
};

export const CRISP_DM_CASES = ["crisp-dm-1", "crisp-dm-2", "crisp-dm-3", "crisp-dm-4"].map(
  (s) => ACTIVITIES[s],
);
