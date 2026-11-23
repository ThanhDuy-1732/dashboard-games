import type { DinoMap } from "@nha-choi/game-core";

export const DINO_MAP_IDS = ["volcano", "forest", "ice"] as const;

interface MapTheme {
  title: string;
  terrain: readonly [number, number, number, number, number];
  sky: readonly [string, string, string, string];
  mist: number;
  sun: number;
  floor: number;
  floorGlow: number;
  rim: number;
  particles: number;
}

export const DINO_MAPS: Record<DinoMap, MapTheme> = {
  volcano: {
    title: "Núi lửa",
    terrain: [0x555667, 0x53545f, 0x666171, 0x595664, 0x393742],
    sky: ["#65768f", "#d2a198", "#ffd1a0", "#d9a69b"],
    mist: 0xd3a299, sun: 0xffddae, floor: 0xe94b12, floorGlow: 0xff3608,
    rim: 0xffa23e, particles: 0xffbf78,
  },
  forest: {
    title: "Rừng cổ đại",
    terrain: [0x6f6544, 0x71694b, 0x8a7753, 0x796e50, 0x4e482f],
    sky: ["#385e52", "#759d72", "#d4dba0", "#a6bf91"],
    mist: 0xa4bf91, sun: 0xfff0bd, floor: 0x286760, floorGlow: 0x1c625a,
    rim: 0x98c9a2, particles: 0xf0e29c,
  },
  ice: {
    title: "Hẻm núi băng",
    terrain: [0x9bb8d7, 0x8aaccc, 0xb2cdda, 0xa4bad1, 0x466e93],
    sky: ["#375d91", "#779cc7", "#d0e8ed", "#a3cbdf"],
    mist: 0xaacde2, sun: 0xcce9ff, floor: 0x275d84, floorGlow: 0x25749c,
    rim: 0xc8f7ff, particles: 0xe2f6ff,
  },
};
