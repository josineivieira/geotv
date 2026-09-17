import { storyFrames } from "./client-story.js";
import { hydroFrames } from "./hydrology.js";
import { salesFrames } from "./sales-show.js";
import { alertFrames } from "./process-alerts.js";
import { monthlyResultFrames } from "./monthly-results.js";
import { goalFrames } from "./goals.js";
export const transitions = ["fade", "slide", "zoom", "none"];
export function presentationFrames(content) {
  if (content.template === "goals") return goalFrames(content);
  if (content.template === "monthly-results")
    return monthlyResultFrames(content);
  if (content.template === "process-alerts") return alertFrames(content);
  if (content.template === "sales-show") return salesFrames(content);
  if (content.template === "hydrology") return hydroFrames(content);
  if (content.template === "client-story") return storyFrames(content);
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
