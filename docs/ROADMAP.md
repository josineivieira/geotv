# Evolução por fases

Esta entrega implementa um caminho funcional entre criação, publicação e TV. Os 20 nomes de modelos usam famílias compartilhadas e personalização controlada; não são 20 editores independentes.

| Fase                  | Entregue                                                                                                                   | Evolução / homologação                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Fundação          | Banco persistente, login, perfis, Admin, Player, cadastro e grupos de TVs                                                  | Reset de senha, edição/bloqueio de usuários, migrações numeradas e gestão dinâmica de permissões                               |
| 2 — Conteúdos         | CRUD, duplicação, filtros, mídia reutilizável, modelos, preview exato                                                      | Logos/ícones/fundos como categorias editáveis, thumbnails geradas no servidor e personalização de marca global                 |
| 3 — Programação       | Múltiplas playlists, arraste/setas, duração, datas, dias/horários, publicação por destino, restauração, aprovação básica   | Fluxo formal de solicitação/rejeição de aprovação, controle de edição concorrente e calendário visual                          |
| 4 — TV                | Loop 16:9, transições, snapshot local, mídia pré-carregada, recuperação offline e vídeo byte-range                         | Homologação 72h, limpeza/orçamento de cache, pré-decodificação de vídeo e política de erro por mídia                           |
| 5 — Tempo real        | SSE com reconexão, fallback periódico, heartbeat e telemetria de versão                                                    | Teste de carga, limites por TV atrás do proxy e barramento para múltiplos servidores                                           |
| 6 — Modelos avançados | Pódio ordenável até 10 participantes, indicadores, comparativos em barras, metas, Rio Negro, comunicados e avisos urgentes | Gráficos de linha, paginação de rankings maiores, Top clientes/abaixo da meta e revisão dos layouts com a identidade oficial   |
| 7 — Dados automáticos | Tabela reservada e registro/contrato de conectores backend                                                                 | Implementar adaptadores autorizados, agendador, credenciais, painel de fontes e revisão/publicação de atualizações automáticas |

## Limites explícitos

- Os indicadores são manuais. Nenhuma API, ERP, MongoDB, PostgreSQL, Excel ou SharePoint está conectada.
- Páginas externas não são incorporadas. Isso depende de lista de origens autorizadas e de uma política de iframe.
- Um dispositivo pertence a um grupo. Selecionar um grupo resolve a lista de TVs no momento da publicação; novas TVs não herdam publicações antigas automaticamente.
- O Admin permite criar usuários e consultar perfis, mas o ciclo completo de recuperação/rotação de senha ainda precisa ser implementado.
- Conteúdo com texto longo pode exceder o espaço seguro de uma TV. O preview deve fazer parte da revisão editorial; os campos possuem limites gerais, não medição tipográfica automática.
- O horário recorrente usa o timezone do canal. Campos de data/hora absoluta no editor usam o fuso do computador e são armazenados em UTC.
- A arquitetura inicial é de um único processo/servidor. Não apresentar esta versão como infraestrutura distribuída pronta.

## Verificação realizada

Testes de regras de agendamento e escape de conteúdo; integração real com SQLite para sessão, autorização, publicação, isolamento de rascunho, restauração, upload inválido, heartbeat, aprovação e urgência; Chrome headless para login, edição, Player e recarga offline. As capturas ficam em `test-results/`.

O ambiente operacional permanece sem conteúdos demonstrativos. Fixtures criadas pelos testes são identificadas e usam banco/perfil temporários.
