export const storyCards = [
  [
    "new",
    "Novo",
    "40",
    "Clientes embarcando com a Geo pela primeira vez.",
    "Movimentação de clientes",
    "★",
  ],
  [
    "up",
    "Aumentou",
    "72",
    "Clientes recorrentes com aumento superior a 10% em relação ao trimestre anterior.",
    "Movimentação de clientes",
    "↑",
  ],
  [
    "stable",
    "Manteve",
    "6",
    "Clientes recorrentes com variação entre −10% e +10% em relação ao trimestre anterior.",
    "Movimentação de clientes",
    "→",
  ],
  [
    "down",
    "Diminuiu",
    "28",
    "Clientes recorrentes com queda superior a 10% em relação ao trimestre anterior.",
    "Movimentação de clientes",
    "↓",
  ],
  [
    "recovered",
    "Recuperado",
    "18",
    "Clientes sem embarques nos últimos trimestres que voltaram a embarcar.",
    "Movimentação de clientes",
    "↻",
  ],
  [
    "lost",
    "Perdido",
    "50",
    "Clientes que embarcaram no trimestre anterior, mas não neste trimestre.",
    "Movimentação de clientes",
    "×",
  ],
  [
    "churn",
    "Churn",
    "32,9%",
    "Clientes perdidos em relação aos clientes ativos no trimestre anterior.",
    "Movimentação de clientes",
    "◉",
  ],
];
export const storyDefaults = {
  period: "3º trimestre de 2026",
  best: "C M DISTRIBUIDORA;119\nNOVA ERA;83\nAGRO SUL CATARINENSE;67\nSUPERMERCADOS DB;61\nBEBIDAS GRASSI;54",
  offenders:
    "SUPERMERCADOS DB;56;0;-56\nBEBIDAS GRASSI;57;4;-53\nELETROFRIO;34;0;-34\nAGROHORT;34;1;-33\nSUPERMERCADO GAVIAO;16;1;-15",
  ...Object.fromEntries(
    storyCards.flatMap(([key, , value, caption]) => [
      [key, value],
      [key + "Caption", caption],
    ]),
  ),
};
export function storyFrames(content) {
  return Array.from({ length: storyCards.length + 2 }, (_, index) => ({
    ...content,
    id: `${content.id || "preview"}:story:${index}`,
    duration: content.duration / (storyCards.length + 2),
    transition: "fade",
    fields: { ...storyDefaults, ...content.fields, storyScene: index },
  }));
}
