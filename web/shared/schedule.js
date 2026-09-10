export function eligible(
  content,
  date = new Date(),
  timezone = "America/Sao_Paulo",
) {
  if (
    content.active === false ||
    ["Arquivado", "Encerrado"].includes(content.status)
  )
    return false;
  if (content.start && date < new Date(content.start)) return false;
  if (content.end && date >= new Date(content.end)) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    part("weekday"),
  );
  if (content.days?.length && !content.days.includes(day)) return false;
  const clock = part("hour") + ":" + part("minute");
  if (content.timeStart && content.timeEnd) {
    if (
      content.timeStart <= content.timeEnd
        ? clock < content.timeStart || clock >= content.timeEnd
        : clock < content.timeStart && clock >= content.timeEnd
    )
      return false;
  } else {
    if (content.timeStart && clock < content.timeStart) return false;
    if (content.timeEnd && clock >= content.timeEnd) return false;
  }
  return true;
}
