import { uploadFile } from "./uploads.js";
export async function importDocument(file, onPage, onProgress, signal) {
  if (file.size > 40 * 1024 * 1024)
    throw new Error("O documento deve ter até 40 MB.");
  const extension = file.name.split(".").pop().toLowerCase();
  let bytes;
  if (extension === "pdf") {
    bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw new Error("PDF inválido.");
  } else if (["ppt", "pptx"].includes(extension)) {
    onProgress("Convertendo PowerPoint no servidor…");
    const response = await fetch("/api/imports/powerpoint", {
      method: "POST",
      headers: {
        "Content-Type":
          extension === "ppt"
            ? "application/vnd.ms-powerpoint"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
      signal,
    });
    if (!response.ok) throw new Error((await response.json()).error);
    bytes = await response.arrayBuffer();
  } else throw new Error("Use PDF, PPT ou PPTX.");
  signal.throwIfAborted();
  const pdfjs = await import("/vendor/pdfjs/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/build/pdf.worker.mjs";
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useWasm: false,
    cMapUrl: "/vendor/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
  });
  const abort = () => task.destroy();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const doc = await task.promise;
    if (doc.numPages > 60)
      throw new Error("Use documentos com até 60 páginas.");
    for (let i = 1; i <= doc.numPages; i++) {
      signal.throwIfAborted();
      onProgress(`Importando página ${i} de ${doc.numPages}…`);
      const page = await doc.getPage(i),
        original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(1920 / original.width, 1080 / original.height),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      try {
        await page.render({
          canvasContext: context,
          viewport,
          background: "rgb(255,255,255)",
        }).promise;
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob)
          throw new Error("Não foi possível gerar a imagem da página.");
        signal.throwIfAborted();
        const media = await uploadFile(
          new File(
            [blob],
            `${file.name.replace(/\.[^.]+$/, "").slice(0, 120)} — ${i}.png`,
            { type: "image/png" },
          ),
        );
        signal.throwIfAborted();
        await onPage(media);
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
  } catch (error) {
    if (error.name === "PasswordException")
      throw new Error(
        "O documento tem senha. Remova a senha antes de importar.",
      );
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
