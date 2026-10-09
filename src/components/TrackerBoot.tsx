"use client";

import { useEffect } from "react";

export type TrackerConfig = {
  sessionId: string;
  loginUrl: string;
  settings: Record<string, number>;
  module?: string | null;
  title?: string;
};

type TrackerApi = { setContext(c: { sessionId: string; module: string | null; page: string; title?: string }): void };
type TrackerWindow = Window & { __trk?: TrackerApi; __TRK_CFG?: Record<string, unknown> };

/**
 * Loads the shared tracker in the outer portal page (EV-1). It stays loaded across client navigations;
 * each page just updates the context so heartbeats and page views name the right module.
 */
export default function TrackerBoot({ config }: { config: TrackerConfig }) {
  const { sessionId, loginUrl, settings, module = null, title } = config;

  useEffect(() => {
    const w = window as TrackerWindow;
    const page = window.location.pathname;
    if (w.__trk) {
      w.__trk.setContext({ sessionId, module, page, title });
      return;
    }
    w.__TRK_CFG = {
      kind: "page",
      endpoint: "/api/events",
      endEndpoint: "/api/session/end",
      loginUrl,
      sessionId,
      module,
      title,
      settings,
    };
    const s = document.createElement("script");
    s.src = "/tracker.js?v=2";
    s.async = true;
    document.head.appendChild(s);
  }, [sessionId, loginUrl, settings, module, title]);

  return null;
}
