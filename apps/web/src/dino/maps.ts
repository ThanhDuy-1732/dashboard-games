import type { DinoMap } from "@nha-choi/game-core";

export const DINO_MAP_IDS = ["volcano", "forest", "ice", "desert", "swamp"] as const;

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
  desert: {
    title: "Sa mạc đỏ",
    terrain: [0xc58d5c, 0xbb7951, 0xcc9665, 0xac6d49, 0x834837],
    sky: ["#4c7397", "#b9c4ca", "#ffe2b2", "#ecb17b"],
    mist: 0xe8b181, sun: 0xffe39b, floor: 0xb46c4e, floorGlow: 0x744438,
    rim: 0xffcc8a, particles: 0xffcc92,
  },
  swamp: {
    title: "Đầm lầy sương",
    terrain: [0x667075, 0x5f756e, 0x72776f, 0x536763, 0x374b47],
    sky: ["#2c4d59", "#597975", "#9cc4ac", "#75958d"],
    mist: 0x7b9a90, sun: 0xc2e0cd, floor: 0x306a62, floorGlow: 0x173d35,
    rim: 0x63ad93, particles: 0xb9e88d,
  },
};
