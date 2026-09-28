"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PageSize = { w: number; h: number };

/**
 * Renders every page of a PDF to canvas with PDF.js, fitted to the screen width.
 * Mobile browsers can't show PDFs in an iframe (iOS shows one page, Android none).
 */
export default function PdfViewer({ src, title }: { src: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [width, setWidth] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load the document and every page's size (cheap; no drawing yet).
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({ url: src });
        task.onProgress = ({ loaded: l, total }: { loaded: number; total: number }) => {
          if (total) setProgress(Math.round((l / total) * 100));
        };
        const loaded = await task.promise;
        const all: PageSize[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const vp = (await loaded.getPage(i)).getViewport({ scale: 1 });
          all.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        setSizes(all);
        setDoc(loaded);
      } catch {
        if (!cancelled) setError("This PDF couldn't be displayed. Use the Download button to open it.");
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [src]);

  // Track the available width so pages re-fit on resize / rotation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(0, Math.min(width - 24, 1000));

  return (
    <div className="pdf-scroll" ref={scrollRef} aria-label={title}>
      {error && <p className="pdf-status error-text">{error}</p>}
      {!error && !doc && <p className="pdf-status">Loading PDF… {progress > 0 && `${progress}%`}</p>}
      {doc &&
        pageWidth > 0 &&
        sizes.map((s, i) => (
          <PdfPage key={i} doc={doc} pageNumber={i + 1} width={pageWidth} height={(pageWidth * s.h) / s.w} root={scrollRef} />
        ))}
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  width,
  height,
  root,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  // Draw only pages near the viewport, keeping memory low on phones.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: root.current,
      rootMargin: "1200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      try {
        await task.promise;
      } catch {
        /* cancelled by a newer render */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, visible]);

  return (
    <div className="pdf-page" ref={boxRef} style={{ width, height }}>
      <canvas ref={canvasRef} style={{ width, height }} aria-label={`Page ${pageNumber}`} />
    </div>
  );
}
