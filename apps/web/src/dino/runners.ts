import type { DinoEvolution } from "@nha-choi/game-core";

export const DINO_RUNNERS = {
  lizard: { title: "Thằn lằn", color: 0x71944e },
  raptor: { title: "Raptor", color: 0x38939b },
  triceratops: { title: "Tam giác long", color: 0xc5794a },
} as const;

export type DinoRunner = keyof typeof DINO_RUNNERS;
export const DINO_RUNNER_IDS = ["lizard", "raptor", "triceratops"] as const;

export const DINO_FORMS = {
  giant: { title: "Khổng lồ", detail: "To hơn, húc vỡ thân cây", color: 0xffb16b },
  swift: { title: "Tia chớp", detail: "Chạy và đổi làn nhanh hơn", color: 0xffed86 },
  winged: { title: "Có cánh", detail: "Nhảy cao, rơi chậm", color: 0xc9a5ff },
} satisfies Record<DinoEvolution, { title: string; detail: string; color: number }>;

export const DINO_FORM_IDS = ["giant", "swift", "winged"] as const;
