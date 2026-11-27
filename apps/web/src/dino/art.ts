import {
  BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry,
  DodecahedronGeometry, DoubleSide, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, OctahedronGeometry, PlaneGeometry, Shape, ShapeGeometry,
  SphereGeometry, SRGBColorSpace, TorusGeometry,
} from "three";

import { DINO_DUCK_CLEARANCE_M, DINO_LANE_WIDTH } from "@nha-choi/game-core";
import type { DinoMap } from "@nha-choi/game-core";
import { DINO_MAPS } from "./maps.js";
import { DINO_RUNNERS } from "./runners.js";
import type { DinoRunner } from "./runners.js";
const standard = (color: number) => new MeshStandardMaterial({ color, roughness: 0.92 });

function roadTexture(map: DinoMap) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = map === "ice" ? "#e6f2f7" : "#e3dee2";
  context.fillRect(0, 0, 128, 128);
  let seed = 79;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let index = 0; index < 1900; index++) {
    context.fillStyle = index % 3 === 0 ? "#fff9" : "#65596b40";
    context.fillRect(random() * 128, random() * 128, random() * 3 + 1, random() * 2 + 1);
  }
  context.lineWidth = 1.35;
  context.strokeStyle = map === "ice" ? "#94cbebaa" : "#514657bb";
  context.beginPath();
  if (map === "swamp") {
    context.lineWidth = 3;
    for (let y = 7; y < 128; y += 24) {
      context.moveTo(0, y);
      context.lineTo(128, y + 1);
    }
  } else if (map === "desert") {
    context.strokeStyle = "#b99c7c9c";
    for (let y = 4; y < 127; y += 19) {
      context.moveTo(0, y);
      context.quadraticCurveTo(62, y + 19, 128, y - 7);
    }
  } else if (map !== "forest") {
    context.moveTo(0, 19);
    context.lineTo(33, 30);
    context.lineTo(69, 25);
    context.lineTo(77, 54);
    context.lineTo(127, 103);
    context.moveTo(77, 54);
    context.lineTo(64, 81);
    context.lineTo(69, 128);
  }
  context.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createDinoSky(map: DinoMap) {
  const stops = DINO_MAPS[map].sky;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, stops[0]);
  sky.addColorStop(0.36, stops[1]);
  sky.addColorStop(0.57, stops[2]);
  sky.addColorStop(1, stops[3]);
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createDinoArt(map: DinoMap, runner: DinoRunner) {
  const theme = DINO_MAPS[map];
  const terrain = theme.terrain;
  const stone = [
    standard(terrain[0]), standard(terrain[1]), standard(terrain[2]),
    standard(terrain[3]), standard(terrain[4]),
  ] as const;
  const rockMaterial = (index: number) => stone[index % stone.length] ?? stone[0];
  const rockMap = roadTexture(map);
  const pavement = terrain.map((color) => new MeshStandardMaterial({ color, map: rockMap, roughness: map === "ice" ? 0.45 : 1 }));
  const green = standard(DINO_RUNNERS[runner].color);
  const belly = standard(0xb6be73);
  const darkGreen = standard(0x405735);
  const eye = new MeshBasicMaterial({ color: 0x181517 });
  const floorMaterial = new MeshStandardMaterial({ color: theme.floor, emissive: theme.floorGlow, emissiveIntensity: map === "volcano" ? 0.65 : 0.28 });
  const flare = new MeshBasicMaterial({ color: 0xffa23e });
  const rim = new MeshBasicMaterial({ color: theme.rim });
  const dustMaterial = new MeshBasicMaterial({ color: 0xcf9370, transparent: true, opacity: 0, depthWrite: false });
  const ashMaterial = new MeshBasicMaterial({ color: theme.particles, transparent: true, opacity: 0.65 });
  const itemMaterial = new MeshBasicMaterial({ color: 0xffc064 });
  const cube = new BoxGeometry();
  const plane = new PlaneGeometry();
  const round = new SphereGeometry(1, 16, 10);
  const rock = new DodecahedronGeometry(1);
  const facet = new IcosahedronGeometry(1, 0);
  const column = new CylinderGeometry(0.48, 0.65, 1, 6);
  const cone = new ConeGeometry(1, 1, 7);
  const crystal = new OctahedronGeometry(1);
  const ring = new TorusGeometry(1, 0.08, 5, 24);
  const world = new Group();

  function mesh(
    parent: Group, geometry: BufferGeometry,
    material: MeshStandardMaterial | MeshBasicMaterial,
    x: number, y: number, z: number, width: number, height: number, depth: number,
  ) {
    const shape = new Mesh(geometry, material);
    shape.position.set(x, y, z);
    shape.scale.set(width, height, depth);
    parent.add(shape);
    return shape;
  }

  mesh(world, cube, floorMaterial, 0, -1.6, -42, 130, 0.4, 150);
  const smoke = [];
  if (map === "volcano") {
    mesh(world, cone, stone[4], -16, 9, -88, 25, 28, 21);
    mesh(world, cone, stone[1], -6, 10, -96, 16, 31, 16);
    mesh(world, column, floorMaterial, -6, 24.65, -96, 2.7, 1.2, 2.7);
    const lavaFlow = mesh(world, cube, flare, -3.3, 17.4, -87.35, 0.52, 14.7, 0.25);
    lavaFlow.rotation.z = 0.36;
    lavaFlow.rotation.x = 0.76;
    const smokeMaterial = standard(0x564555);
    for (let index = 0; index < 7; index++) {
      const size = 1.7 + index * 0.45;
      const puff = mesh(world, facet, smokeMaterial, -6 + index * 1.72, 26 + index * 1.28, -96 + (index % 3), size, size * 0.72, size);
      puff.rotation.y = index * 0.74;
      smoke.push(puff);
    }
  }
  const accent = map === "forest" ? standard(0x2f6e47) : map === "swamp" ? standard(0x365f45) : stone[2];
  const accentTip = map === "forest" ? standard(0x4c9355) : standard(0xc4ebf7);
  const trunk = map === "forest" ? standard(0x65402a) : stone[4];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 5; index++) {
      const hill = mesh(world, cone, rockMaterial(index + 2), side * (31 + index * 5), 2, -52 - index * 9, 13, 10 + (index % 3) * 4, 15);
      hill.rotation.y = index;
      if (map === "ice") {
        mesh(world, cone, accentTip, hill.position.x, 7.7 + (index % 3) * 3, hill.position.z, 6.5, 9, 7.5).rotation.y = index;
      }
    }
  }

  const road = Array.from({ length: 40 }, (_, index) => [-1, 0, 1].map((lane) =>
    [0, 1].map(() => {
      const slab = new Group();
      slab.position.x = lane * DINO_LANE_WIDTH;
      world.add(slab);
      mesh(slab, cube, stone[4], 0, -0.31, 0, DINO_LANE_WIDTH, 0.61, 1);
      const material = pavement[(index * 7 + lane * 3) % pavement.length] ?? stone[0];
      const top = mesh(slab, plane, material, 0, 0.001, 0, DINO_LANE_WIDTH - 0.02, 0.99, 1);
      top.rotation.x = -Math.PI / 2;
      if ((lane + index) % 3 === 0) top.rotation.z = Math.PI;
      return slab;
    }),
  ));
  const banks = Array.from({ length: 26 }, (_, index) => {
    const bank = new Group();
    world.add(bank);
    for (const side of [-1, 1]) {
      const height = 1.25 + ((index * 37 + side * 5) % 11 + 11) % 11 * 0.29;
      if (map === "volcano") {
        const pillar = mesh(bank, column, rockMaterial(index + (side === 1 ? 2 : 0)), side * (4.6 + (index % 3) * 0.45), height / 2 - 0.85, 0, 2.05, height, 3.25);
        pillar.rotation.y = index * 0.73;
        mesh(bank, rock, rockMaterial(index + 2), side * 7.5, height / 2 - 0.6, 0.6, 2.6, height * 0.7, 2).rotation.y = index;
      } else if (map === "forest") {
        const x = side * (5.4 + (index % 3) * 0.5);
        mesh(bank, rock, accent, side * 4.15, -0.31, 0, 1.35, 0.72, 2.1);
        mesh(bank, column, trunk, x, 2.5, 0.4, 0.94, 6.2, 0.86).rotation.z = side * -0.07;
        mesh(bank, rock, accent, x - side * 0.85, 5.65 + (index % 4) * 0.4, 0.4, 3.45, 1.52, 2.4).rotation.y = index;
        mesh(bank, rock, accentTip, x + side * 0.55, 6.9, 0.8, 2.45, 1.29, 1.97).rotation.y = index * 0.6;
      } else if (map === "ice") {
        const x = side * (4.8 + (index % 3) * 0.65);
        mesh(bank, rock, stone[4], x, -0.25, 0, 1.8, 1.04, 2.2);
        mesh(bank, crystal, accentTip, x, height * 0.65 + 0.35, -0.5, 1.16, height * 1.17, 1.06).rotation.z = side * -0.24;
        mesh(bank, crystal, accent, x + side * 1.1, height * 0.64, 0.8, 1.05, height * 0.91, 0.89).rotation.z = side * 0.34;
      } else if (map === "desert") {
        const x = side * (9 + (index % 3) * 4);
        mesh(bank, round, stone[1], side * 5.3, -1.02, 0, 3.4, 0.78 + index % 3 * 0.22, 3.45);
        if ((index + (side < 0 ? 2 : 0)) % 4 === 0) {
          mesh(bank, column, stone[3], x, 1.6, 0.8, 3.25, 5.5, 3.9).rotation.y = index;
          mesh(bank, column, stone[0], x, 4.45, 0.8, 2.92, 0.36, 3.4);
        }
      } else if (map === "swamp") {
        const x = side * 6.2;
        mesh(bank, round, accent, side * 4.35, -1.14, 0.4, 1.85, 0.4, 1.9);
        if ((index + (side === 1 ? 1 : 0)) % 3 !== 0) {
          mesh(bank, column, stone[4], x, 1.5, 0.6, 0.83, 4.9, 0.66).rotation.z = side * 0.24;
          mesh(bank, rock, accent, x + side * 0.45, 3.9, 0.6, 2.75, 0.64, 1.91).rotation.y = index;
          mesh(bank, cone, accent, x - side * 1.15, 2.66, 0.3, 0.32, 1.26, 0.38).rotation.z = Math.PI;
        }
      }
    }
    return bank;
  });
  const warningMaterial = new MeshBasicMaterial({ color: 0xffa833 });
  const boulders = Array.from({ length: 7 }, () => {
    const group = new Group();
    world.add(group);
    const stoneBall = mesh(group, rock, stone[1], 0, 0.37, 0, 0.45, 0.4, 0.59);
    const warning = mesh(group, ring, warningMaterial, 0, 0.025, 0, 0.62, 0.62, 0.62);
    warning.rotation.x = -Math.PI / 2;
    const pebbles = [0, 1, 2].map((index) =>
      mesh(group, facet, rockMaterial(index + 1), 0, 0.08, (index - 1) * 0.36, 0.11, 0.11, 0.11),
    );
    return { group, stoneBall, warning, pebbles };
  });
  const gaps = Array.from({ length: 6 }, () => {
    const group = new Group();
    world.add(group);
    mesh(group, cube, floorMaterial, 0, -0.66, 0, 5.65, 0.045, 1);
    mesh(group, cube, rim, 0, -0.065, -0.49, 5.46, 0.15, 0.025);
    mesh(group, cube, rim, 0, -0.065, 0.49, 5.46, 0.15, 0.025);
    const sides = [-1, 1].map((side) => mesh(group, cube, rim, side * 2.7, -0.065, 0, 0.075, 0.15, 1));
    sides.forEach((bar) => { bar.visible = false; });
    return { group, sides };
  });
  const bark = standard(0x4e2a22);
  const wood = standard(0xb37443);
  const logGeometry = new CylinderGeometry(1, 1, 1, 9);
  const logs = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    mesh(group, logGeometry, bark, 0, 0.26, 0, 0.26, 3.45, 0.45).rotation.z = Math.PI / 2;
    for (const end of [-1, 1]) {
      mesh(group, logGeometry, wood, end * 1.73, 0.26, 0, 0.2, 0.04, 0.37).rotation.z = Math.PI / 2;
      mesh(group, cone, bark, end * 0.65, 0.34, 0, 0.11, 0.39, 0.15).rotation.z = end * -0.62;
    }
    return group;
  });
  const pillars = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    mesh(group, column, stone[4], 0, 1.17, 0, 0.89, 2.34, 0.92).rotation.y = 0.16;
    mesh(group, rock, stone[1], 0, 2.27, 0, 0.42, 0.15, 0.43);
    const fissure = mesh(group, cube, flare, -0.2, 1.13, 0.5, 0.055, 1.38, 0.07);
    fissure.rotation.z = -0.14;
    return group;
  });
  const archWarning = new MeshBasicMaterial({ color: 0xffc678 });
  const arches = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    for (const side of [-1, 1]) {
      mesh(group, column, stone[4], side * 3.22, 0.66, 0, 0.92, 1.7, 1.8);
      mesh(group, rock, stone[2], side * 2.82, 1.45, 0, 0.81, 0.72, 0.83);
    }
    mesh(group, cube, stone[4], 0, DINO_DUCK_CLEARANCE_M + 0.74, 0, 6.1, 1.48, 1.8);
    mesh(group, rock, stone[1], 0.55, 2.14, 0, 2.6, 0.58, 0.9).rotation.z = 0.08;
    mesh(group, cube, archWarning, 0, DINO_DUCK_CLEARANCE_M + 0.04, 0.909, 5.45, 0.045, 0.02);
    return group;
  });
  const overhangs = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    const y = DINO_DUCK_CLEARANCE_M + 1.05;
    mesh(group, logGeometry, bark, 0, y, 0, 1.05, 6.5, 0.9).rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      mesh(group, logGeometry, wood, side * 3.25, y, 0, 0.87, 0.05, 0.78).rotation.z = Math.PI / 2;
      mesh(group, cone, bark, side * 1.8, y + 0.82, 0, 0.32, 1.12, 0.27).rotation.z = side * -0.6;
    }
    mesh(group, cube, archWarning, 0, DINO_DUCK_CLEARANCE_M + 0.09, 0.42, 5.45, 0.045, 0.025);
    return group;
  });
  const vents = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    const mouth = mesh(group, ring, flare, 0, 0.032, 0, 0.55, 0.45, 0.55);
    mouth.rotation.x = -Math.PI / 2;
    const plume = new Group();
    group.add(plume);
    mesh(plume, cone, floorMaterial, 0, 1.18, 0, 0.51, 2.36, 0.47).rotation.z = 0.1;
    mesh(plume, cone, flare, 0.22, 0.83, 0.12, 0.28, 1.66, 0.27).rotation.z = -0.19;
    mesh(plume, facet, flare, -0.13, 2.31, -0.04, 0.14, 0.22, 0.13);
    return { group, plume };
  });
  const iceTint = standard(0x78c3ed);
  const iceSpikes = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    mesh(group, crystal, accentTip, -0.12, 0.91, 0, 0.45, 1.56, 0.51).rotation.z = -0.17;
    mesh(group, crystal, iceTint, 0.3, 0.51, 0.1, 0.36, 0.97, 0.42).rotation.z = -0.21;
    return group;
  });
  const mudSurface = new MeshStandardMaterial({ color: 0x385133, emissive: 0x152907, emissiveIntensity: 0.32 });
  const mudRim = standard(0x8e9662);
  const puddles = Array.from({ length: 3 }, () => {
    const group = new Group();
    world.add(group);
    mesh(group, round, mudRim, 0, 0.014, 0, 0.78, 0.023, 1.07);
    mesh(group, round, mudSurface, -0.07, 0.035, 0.05, 0.68, 0.022, 0.92);
    for (const x of [-0.32, 0.16, 0.38]) {
      mesh(group, rock, mudRim, x, 0.048, x * -1.6, 0.055, 0.044, 0.052);
    }
    return group;
  });
  const items = Array.from({ length: 7 }, () => {
    const group = new Group();
    const material = itemMaterial.clone();
    world.add(group);
    const gem = mesh(group, crystal, material, 0, 0.55, 0, 0.25, 0.34, 0.25);
    const halo = mesh(group, ring, material, 0, 0.025, 0, 0.48, 0.48, 0.48);
    halo.rotation.x = -Math.PI / 2;
    return { group, gem, material };
  });

  const dino = new Group();
  world.add(dino);
  const horned = runner === "triceratops";
  const sleek = runner === "raptor";
  const armored = runner === "ankylosaurus";
  const flying = runner === "pteranodon";
  const plated = runner === "stegosaurus";
  const fourLegged = horned || armored || plated;
  const headY = armored ? 0.51 : plated ? 0.6 : horned ? 0.65 : flying ? 1.15 : sleek ? 0.99 : 0.94;
  const mouthY = headY - 0.11;
  mesh(dino, round, green, 0, 0.56, 0.08, fourLegged ? 0.45 : sleek || flying ? 0.24 : 0.3, 0.33, fourLegged ? 0.65 : 0.48);
  mesh(dino, round, belly, 0, 0.48, -0.16, 0.25, 0.24, 0.28);
  mesh(dino, round, green, 0, (headY + 0.56) / 2, -0.27, 0.23, 0.31, 0.25);
  mesh(dino, round, green, 0, headY, -0.46, horned ? 0.34 : sleek || flying ? 0.205 : 0.3, flying ? 0.16 : 0.245, sleek ? 0.43 : 0.38);
  if (!flying) mesh(dino, round, belly, 0, mouthY, -0.64, sleek ? 0.17 : 0.258, 0.105, 0.246);
  const ivory = standard(0xffda96);
  if (horned) {
    mesh(dino, round, darkGreen, 0, 0.79, -0.3, 0.48, 0.41, 0.12).rotation.x = -0.38;
    mesh(dino, cone, ivory, 0, 0.81, -0.8, 0.085, 0.22, 0.09).rotation.x = -0.46;
  }
  if (flying) {
    mesh(dino, cone, ivory, 0, headY - 0.06, -0.83, 0.16, 0.67, 0.105).rotation.x = -Math.PI / 2;
    mesh(dino, cone, darkGreen, 0, headY + 0.26, -0.18, 0.15, 0.73, 0.16).rotation.x = 0.9;
  }
  if (armored) {
    const shell = standard(0x504365);
    mesh(dino, rock, shell, 0, 0.68, 0.09, 0.56, 0.39, 0.65);
    for (let index = 0; index < 4; index++) {
      const z = -0.36 + index * 0.27;
      for (const side of [-1, 1]) {
        mesh(dino, facet, ivory, side * 0.4, 0.79, z, 0.15, 0.14, 0.15);
      }
    }
  }
  if (plated) {
    const plates = standard(0xda8854);
    for (let index = 0; index < 6; index++) {
      const height = 0.17 + (1 - Math.abs(index - 2.5) / 3) * 0.27;
      mesh(dino, crystal, plates, index % 2 ? 0.07 : -0.07, 0.84 + height / 2, -0.38 + index * 0.18, 0.076, height, 0.16).rotation.x = -0.14;
    }
  }
  for (const side of [-1, 1]) {
    mesh(dino, round, eye, side * (sleek ? 0.18 : 0.266), headY + 0.06, -0.5, 0.058, 0.063, 0.063);
    if (horned) {
      mesh(dino, cone, ivory, side * 0.23, 1.02, -0.55, 0.13, 0.39, 0.13).rotation.x = -0.8;
    } else if (!fourLegged && !flying) {
      mesh(dino, round, green, side * 0.22, 0.55, -0.38, 0.075, 0.085, 0.17).rotation.x = 0.28;
    }
    if (sleek) mesh(dino, round, ivory, side * 0.222, 0.65, 0.04, 0.027, 0.06, 0.3);
  }

  const tail = new Group();
  tail.position.set(0, 0.52, 0.36);
  tail.scale.z = horned || flying ? 0.62 : sleek ? 1.4 : 1;
  dino.add(tail);
  mesh(tail, round, green, 0, 0.015, 0.22, 0.178, 0.164, 0.39).rotation.x = -0.14;
  mesh(tail, round, green, 0, 0.08, 0.64, 0.096, 0.09, 0.26).rotation.x = -0.25;
  for (let index = 0; index < 5; index++) {
    const ridge = mesh(dino, cone, darkGreen, 0, 0.87 - index * 0.025, index * 0.112 - 0.13, 0.11 - index * 0.009, 0.16, 0.1);
    ridge.rotation.x = 0.3;
  }
  if (sleek) {
    for (let index = 0; index < 4; index++) {
      mesh(tail, cone, ivory, 0, 0.14, 0.32 + index * 0.13, 0.09, 0.24, 0.10).rotation.x = 0.42;
    }
  }
  if (armored) mesh(tail, rock, darkGreen, 0, 0.09, 0.89, 0.25, 0.2, 0.24);
  if (plated) {
    for (const side of [-1, 1]) {
      mesh(tail, cone, ivory, side * 0.16, 0.13, 0.68, 0.082, 0.32, 0.078).rotation.z = side * -0.93;
      mesh(tail, cone, ivory, side * 0.11, 0.15, 0.87, 0.065, 0.24, 0.064).rotation.z = side * -0.83;
    }
  }
  const giantCrest = new Group();
  dino.add(giantCrest);
  const crestMaterial = new MeshBasicMaterial({ color: 0xffc384 });
  for (let index = 0; index < 5; index++) {
    const spike = mesh(giantCrest, cone, crestMaterial, 0, headY + 0.13 - index * 0.046, -0.39 + index * 0.18, 0.095, 0.26 - index * 0.025, 0.095);
    spike.rotation.x = 0.42;
  }

  const limbPositions = fourLegged ? [[-0.3, 0.27], [0.3, 0.27], [0.3, -0.42], [-0.3, -0.42]] : [[-0.22, 0.13], [0.22, 0.13]];
  const legs = limbPositions.map(([x = 0, z = 0]) => {
    const leg = new Group();
    dino.add(leg);
    leg.position.set(x, 0.53, z);
    mesh(leg, round, green, 0, -0.19, 0.035, 0.15, 0.25, 0.165);
    const foot = mesh(leg, round, darkGreen, 0, -0.456, -0.07, 0.138, 0.074, 0.21);
    return { leg, foot };
  });
  const wingShape = new Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.37, 0.24);
  wingShape.lineTo(1.07, 0.16);
  wingShape.lineTo(0.73, -0.07);
  wingShape.lineTo(0.54, -0.03);
  wingShape.lineTo(0.33, -0.22);
  wingShape.closePath();
  const wingGeometry = new ShapeGeometry(wingShape);
  const membrane = new MeshBasicMaterial({ color: 0xb786fa, side: DoubleSide });
  const wings = [-1, 1].map((side) => {
    const joint = new Group();
    joint.position.set(side * 0.22, 0.72, 0.05);
    dino.add(joint);
    mesh(joint, wingGeometry, membrane, 0, 0, 0, side, 1, 1).rotation.x = -0.48;
    return joint;
  });
  const trailMaterial = new MeshBasicMaterial({ color: 0xffdc69, transparent: true, opacity: 0.65, depthWrite: false });
  const speedTrails = Array.from({ length: 10 }, () => mesh(world, cube, trailMaterial, 0, 0, 0, 0.022, 0.022, 0.7));
  const shadow = mesh(world, round, new MeshBasicMaterial({ color: 0x241923, transparent: true, opacity: 0.32, depthWrite: false }), 0, 0.007, 0.08, 0.36, 0.005, 0.58);
  const shieldMaterial = new MeshBasicMaterial({
    color: 0x68ffbf, wireframe: true, transparent: true, opacity: 0.33, depthWrite: false,
  });
  const shield = mesh(world, rock, shieldMaterial, 0, 0.59, -0.04, 0.63, 0.78, 0.87);
  const dust = Array.from({ length: 8 }, () => mesh(world, facet, dustMaterial, 0, 0, 0, 0.11, 0.1, 0.11));
  const ash = Array.from({ length: 22 }, (_, index) =>
    mesh(world, facet, ashMaterial, 0, 0, 0, 0.027 + index % 3 * 0.01, 0.03, 0.026),
  );
  const flameMaterials = [0xff671d, 0xffab32, 0xffe58a]
    .map((color) => new MeshBasicMaterial({ color }));
  const flames = Array.from({ length: 13 }, (_, index) =>
    mesh(world, facet, flameMaterials[index % flameMaterials.length] ?? flare, 0, 0, 0, 1, 1, 1),
  );
  const debris = Array.from({ length: 9 }, (_, index) =>
    mesh(world, facet, index % 3 === 0 ? flare : rockMaterial(index), 0, 0, 0, 0.14, 0.14, 0.14),
  );
  return {
    world, dino, legs, tail, road, banks, boulders, gaps, logs, pillars, arches, overhangs,
    vents, iceSpikes, puddles, items,
    giantCrest, wings, membrane, speedTrails, green, mouthY,
    smoke, shadow, dust, dustMaterial, ash, floorMaterial, rockMap, flames, debris,
    shield, shieldMaterial, pickupShapes: { fire: cone, armor: rock, gem: crystal },
  };
}
