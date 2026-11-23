import {
  BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry,
  DodecahedronGeometry, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, OctahedronGeometry, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry,
} from "three";

const basalt = [0x555667, 0x53545f, 0x666171, 0x595664, 0x393742] as const;
const standard = (color: number) => new MeshStandardMaterial({ color, roughness: 0.92 });

function rockTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#e3dee2";
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
  context.strokeStyle = "#514657bb";
  context.beginPath();
  context.moveTo(0, 19);
  context.lineTo(33, 30);
  context.lineTo(69, 25);
  context.lineTo(77, 54);
  context.lineTo(127, 103);
  context.moveTo(77, 54);
  context.lineTo(64, 81);
  context.lineTo(69, 128);
  context.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createDinoSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#65768f");
  sky.addColorStop(0.36, "#d2a198");
  sky.addColorStop(0.57, "#ffd1a0");
  sky.addColorStop(1, "#d9a69b");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createDinoArt() {
  const stone = [
    standard(basalt[0]), standard(basalt[1]), standard(basalt[2]),
    standard(basalt[3]), standard(basalt[4]),
  ] as const;
  const rockMaterial = (index: number) => stone[index % stone.length] ?? stone[0];
  const rockMap = rockTexture();
  const pavement = basalt.map((color) => new MeshStandardMaterial({ color, map: rockMap, roughness: 1 }));
  const green = standard(0x71944e);
  const belly = standard(0xb6be73);
  const darkGreen = standard(0x405735);
  const eye = new MeshBasicMaterial({ color: 0x181517 });
  const lava = new MeshStandardMaterial({ color: 0xe94b12, emissive: 0xff3608, emissiveIntensity: 0.65 });
  const flare = new MeshBasicMaterial({ color: 0xffa23e });
  const dustMaterial = new MeshBasicMaterial({ color: 0xcf9370, transparent: true, opacity: 0, depthWrite: false });
  const ashMaterial = new MeshBasicMaterial({ color: 0xffbf78, transparent: true, opacity: 0.65 });
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

  mesh(world, cube, lava, 0, -1.6, -42, 130, 0.4, 150);
  mesh(world, cone, stone[4], -16, 9, -88, 25, 28, 21);
  mesh(world, cone, stone[1], -6, 10, -96, 16, 31, 16);
  mesh(world, column, lava, -6, 24.65, -96, 2.7, 1.2, 2.7);
  const lavaFlow = mesh(world, cube, flare, -3.3, 17.4, -87.35, 0.52, 14.7, 0.25);
  lavaFlow.rotation.z = 0.36;
  lavaFlow.rotation.x = 0.76;
  const smokeMaterial = standard(0x564555);
  const smoke = Array.from({ length: 7 }, (_, index) => {
    const size = 1.7 + index * 0.45;
    const puff = mesh(world, facet, smokeMaterial, -6 + index * 1.72, 26 + index * 1.28, -96 + (index % 3), size, size * 0.72, size);
    puff.rotation.y = index * 0.74;
    return puff;
  });
  for (const side of [-1, 1]) {
    for (let index = 0; index < 5; index++) {
      const hill = mesh(world, cone, rockMaterial(index + 2), side * (31 + index * 5), 2, -52 - index * 9, 13, 10 + (index % 3) * 4, 15);
      hill.rotation.y = index;
    }
  }

  const road = Array.from({ length: 40 }, (_, index) => [0, 1].map(() => {
    const slab = new Group();
    world.add(slab);
    mesh(slab, cube, stone[4], 0, -0.31, 0, 5.5, 0.61, 1);
    for (let lane = 0; lane < 3; lane++) {
      const material = pavement[(index * 7 + lane * 3) % pavement.length] ?? stone[0];
      const top = mesh(slab, plane, material, (lane - 1) * 1.81, 0.001, 0, 1.79, 0.99, 1);
      top.rotation.x = -Math.PI / 2;
      if ((lane + index) % 3 === 0) top.rotation.z = Math.PI;
    }
    return slab;
  }));
  const banks = Array.from({ length: 26 }, (_, index) => {
    const bank = new Group();
    world.add(bank);
    for (const side of [-1, 1]) {
      const height = 1.25 + ((index * 37 + side * 5) % 11 + 11) % 11 * 0.29;
      const pillar = mesh(bank, column, rockMaterial(index + (side === 1 ? 2 : 0)), side * (4.6 + (index % 3) * 0.45), height / 2 - 0.85, 0, 2.05, height, 3.25);
      pillar.rotation.y = index * 0.73;
      mesh(bank, rock, rockMaterial(index + 2), side * 7.5, height / 2 - 0.6, 0.6, 2.6, height * 0.7, 2).rotation.y = index;
    }
    return bank;
  });
  const boulders = Array.from({ length: 6 }, () => {
    const group = new Group();
    world.add(group);
    const stoneBall = mesh(group, rock, stone[1], 0, 0.37, 0, 0.45, 0.4, 0.59);
    const pebbles = [0, 1, 2].map((index) =>
      mesh(group, facet, rockMaterial(index + 1), 0, 0.08, (index - 1) * 0.36, 0.11, 0.11, 0.11),
    );
    return { group, stoneBall, pebbles };
  });
  const gaps = Array.from({ length: 6 }, () => {
    const group = new Group();
    world.add(group);
    mesh(group, cube, flare, 0, -0.66, 0, 5.65, 0.045, 1);
    mesh(group, cube, lava, 0, -0.065, -0.49, 5.46, 0.15, 0.025);
    mesh(group, cube, lava, 0, -0.065, 0.49, 5.46, 0.15, 0.025);
    return group;
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
  mesh(dino, round, green, 0, 0.56, 0.08, 0.3, 0.33, 0.48);
  mesh(dino, round, belly, 0, 0.48, -0.16, 0.25, 0.24, 0.28);
  mesh(dino, round, green, 0, 0.78, -0.27, 0.23, 0.31, 0.25);
  mesh(dino, round, green, 0, 0.94, -0.46, 0.3, 0.245, 0.38);
  mesh(dino, round, belly, 0, 0.835, -0.64, 0.258, 0.105, 0.246);
  for (const side of [-1, 1]) {
    mesh(dino, round, eye, side * 0.266, 1, -0.5, 0.058, 0.063, 0.063);
    const arm = mesh(dino, round, green, side * 0.22, 0.55, -0.38, 0.075, 0.085, 0.17);
    arm.rotation.x = 0.28;
  }

  const tail = new Group();
  tail.position.set(0, 0.52, 0.36);
  dino.add(tail);
  mesh(tail, round, green, 0, 0.015, 0.22, 0.178, 0.164, 0.39).rotation.x = -0.14;
  mesh(tail, round, green, 0, 0.08, 0.64, 0.096, 0.09, 0.26).rotation.x = -0.25;
  for (let index = 0; index < 5; index++) {
    const ridge = mesh(dino, cone, darkGreen, 0, 0.87 - index * 0.025, index * 0.112 - 0.13, 0.11 - index * 0.009, 0.16, 0.1);
    ridge.rotation.x = 0.3;
  }
  const evolutionCrest = new Group();
  dino.add(evolutionCrest);
  const crestMaterial = new MeshBasicMaterial({ color: 0xf0c0ff });
  for (let index = 0; index < 5; index++) {
    const spike = mesh(evolutionCrest, cone, crestMaterial, 0, 1.07 - index * 0.065, -0.39 + index * 0.18, 0.095, 0.26 - index * 0.025, 0.095);
    spike.rotation.x = 0.42;
  }

  const legs = [-1, 1].map((side) => {
    const leg = new Group();
    dino.add(leg);
    leg.position.set(side * 0.22, 0.53, 0.13);
    mesh(leg, round, green, 0, -0.19, 0.035, 0.15, 0.25, 0.165);
    const foot = mesh(leg, round, darkGreen, 0, -0.456, -0.07, 0.138, 0.074, 0.21);
    return { leg, foot };
  });
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
    world, dino, legs, tail, road, banks, boulders, gaps, logs, pillars, items, evolutionCrest, green,
    smoke, shadow, dust, dustMaterial, ash, lava, rockMap, flames, debris,
    shield, shieldMaterial, pickupShapes: { fire: cone, armor: rock, gem: crystal },
  };
}
