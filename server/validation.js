import { fail } from "./security.js";
import { templates } from "../web/shared/templates.js";
import { db } from "./db.js";
export function string(value, name, max = 300, required = true) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(400, `${name}: valor inválido.`);
  return value.trim();
}
export async function validateContent(input) {
  const c = { ...input };
  string(c.title, "Título");
  c.category = string(c.category || "Geral", "Categoria", 80);
  c.sector = string(c.sector || "", "Setor", 100, false);
  if (c.active !== undefined && typeof c.active !== "boolean")
    fail(400, "Ativação inválida.");
  if (c.demo !== undefined && typeof c.demo !== "boolean")
    fail(400, "Identificação de demonstração inválida.");
  if (!templates.some((t) => t.id === c.template))
    fail(400, "Modelo inválido.");
  c.duration = Number(c.duration);
  if (c.template === "sales-show" && c.duration < 15)
    fail(400, "Use pelo menos 15 segundos para as 3 telas da campanha.");
  if (c.template === "hydrology" && c.duration < 30)
    fail(400, "Use pelo menos 30 segundos para as 6 telas do boletim.");
  if (c.template === "client-story" && c.duration < 65)
    fail(
      400,
      "Use pelo menos 65 segundos para as 13 telas (5 segundos por tela).",
    );
  if (!Number.isFinite(c.duration) || c.duration < 5 || c.duration > 3600)
    fail(400, "Duração deve ser entre 5 e 3600 segundos.");
  if (
    ![
      "Rascunho",
      "Agendado",
      "Publicado",
      "Encerrado",
      "Arquivado",
      "Aguardando aprovação",
      "Aprovado",
    ].includes(c.status)
  )
    fail(400, "Status inválido.");
  for (const key of ["start", "end"])
    if (c[key] && !Number.isFinite(Date.parse(c[key])))
      fail(400, "Data inválida.");
  if (c.start && c.end && c.start >= c.end)
    fail(400, "O término deve ser posterior ao início.");
  for (const key of ["timeStart", "timeEnd"])
    if (c[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c[key]))
      fail(400, "Horário inválido.");
  if (
    c.days &&
    (!Array.isArray(c.days) ||
      c.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
  )
    fail(400, "Dias inválidos.");
  if (
    !c.fields ||
    typeof c.fields !== "object" ||
    Array.isArray(c.fields) ||
    JSON.stringify(c.fields).length > 30000
  )
    fail(400, "Campos inválidos.");
  for (const value of Object.values(c.fields))
    if (!["string", "number", "boolean"].includes(typeof value))
      fail(400, "Os campos devem conter texto ou números.");
  if (
    c.fields.media &&
    !/^\/media\/[a-f0-9-]+\.(png|jpg|jpeg|webp|mp4|webm)$/.test(c.fields.media)
  )
    fail(400, "Selecione um arquivo da biblioteca.");
  if (c.fields.media) {
    const media = await db
      .prepare("SELECT mime FROM media WHERE url=?")
      .get(c.fields.media);
    if (!media) fail(400, "Arquivo não encontrado na biblioteca.");
    if (
      c.template === "video"
        ? !media.mime.startsWith("video/")
        : !media.mime.startsWith("image/")
    )
      fail(400, "Tipo de arquivo incompatível com o modelo.");
  }
  if (c.template === "presentation") {
    if (c.slides !== undefined) {
      if (!Array.isArray(c.slides) || !c.slides.length || c.slides.length > 60)
        fail(400, "Use entre 1 e 60 telas por apresentação.");
      c.slides = await Promise.all(
        c.slides.map(async (slide) => {
          if (!slide || typeof slide !== "object") fail(400, "Tela inválida.");
          const media =
            typeof slide.media === "string"
              ? await db
                  .prepare("SELECT mime FROM media WHERE url=?")
                  .get(slide.media)
              : null;
          if (!media?.mime.startsWith("image/"))
            fail(400, "Selecione uma imagem válida em cada tela.");
          if (
            !Number.isInteger(slide.duration) ||
            slide.duration < 5 ||
            slide.duration > 300
          )
            fail(400, "Cada tela deve durar entre 5 e 300 segundos.");
          if (
            !["fade", "slide", "zoom", "none"].includes(slide.transition) ||
            !["contain", "cover"].includes(slide.fit)
          )
            fail(400, "Efeito ou enquadramento inválido.");
          return {
            media: slide.media,
            duration: slide.duration,
            transition: slide.transition,
            fit: slide.fit,
            title: string(slide.title || "", "Título da tela", 120, false),
            message: string(
              slide.message || "",
              "Mensagem da tela",
              1000,
              false,
            ),
            showText: !!slide.showText,
          };
        }),
      );
      c.duration = c.slides.reduce((total, slide) => total + slide.duration, 0);
      if (c.duration > 3600)
        fail(400, "A apresentação deve durar no máximo uma hora.");
    }
    if (c.fields.fit && !["contain", "cover"].includes(c.fields.fit))
      fail(400, "Ajuste de imagem inválido.");
    if (
      c.fields.showText !== undefined &&
      typeof c.fields.showText !== "boolean"
    )
      fail(400, "Exibição de texto inválida.");
  } else if (c.slides !== undefined)
    fail(400, "Somente apresentações aceitam múltiplas telas.");
  return c;
}
