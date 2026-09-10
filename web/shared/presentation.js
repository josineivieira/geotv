export const transitions = ["fade", "slide", "zoom", "none"];
export function presentationFrames(content) {
  if (content.template !== "presentation" || !content.slides?.length)
    return [content];
  return content.slides.map((slide, index) => ({
    ...content,
    id: `${content.id || "preview"}:slide:${index}`,
    duration: slide.duration,
    transition: slide.transition,
    slides: undefined,
    fields: {
      ...content.fields,
      media: slide.media,
      fit: slide.fit || "contain",
      showText: !!slide.showText,
      message: slide.message || "",
    },
    title: slide.title || content.title,
  }));
}
export function mediaUrls(content) {
  return [
    content.fields?.media,
    ...(content.slides || []).map((slide) => slide.media),
  ].filter(Boolean);
}
