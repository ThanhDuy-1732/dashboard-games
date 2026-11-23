import {
  AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Mesh,
  PerspectiveCamera, Scene, WebGLRenderer,
} from "three";
import type { Material } from "three";
import type { DinoMap, DinoRun } from "@nha-choi/game-core";
import {
  DINO_ARMOR_FLASH_TICKS, DINO_BOULDER_ROLL_M, DINO_FIRE_BURST_TICKS,
  DINO_FIRE_RANGE_M, DINO_LANE_WIDTH, dinoBoulderOffsetM, dinoObstacleCenterX,
} from "@nha-choi/game-core";
import { createDinoArt, createDinoSky } from "./art.js";
import { DINO_MAPS } from "./maps.js";

export type DinoView = "first" | "third";
const ITEM_COLORS = {
  "speed-up": 0xffc064, "slow-down": 0x79dbff, evolution: 0xf6abff, fire: 0xff6d36, armor: 0x68ffbf,
};

export interface DinoScene {
  render(run: DinoRun, view: DinoView, reducedMotion: boolean): void;
  dispose(): void;
}

export function createDinoScene(canvas: HTMLCanvasElement, map: DinoMap): DinoScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(59, 1, 0.07, 145);
  const theme = DINO_MAPS[map];
  const sky = createDinoSky(map);
  scene.background = sky ?? new Color(theme.mist);
  scene.fog = new Fog(theme.mist, 28, 142);
  const sun = new DirectionalLight(theme.sun, 2.25);
  sun.position.set(-7, 12, -4);
  scene.add(new HemisphereLight(theme.sun, 0x765869, 1.55), new AmbientLight(0xffad85, 0.16), sun);
  const art = createDinoArt(map);
  scene.add(art.world);

  let redraw = () => {};
  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 1 ? 68 : 59;
    camera.updateProjectionMatrix();
    redraw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  let lastDistance = 0;
  let lastHeight = 0;
  let landedAt = -10;
  let landedX = 0;
  return {
    render(run, view, reducedMotion) {
      redraw = () => renderer.render(scene, camera);
      const distance = run.distanceM;
      if (distance < lastDistance) landedAt = -10;
      else if (lastHeight > 0 && run.heightM === 0) {
        landedAt = distance;
        landedX = run.xM;
      }
      lastDistance = distance;
      lastHeight = run.heightM;
      const phase = distance * 4.6;
      const air = run.heightM > 0;
      const bob = air ? 0 : Math.abs(Math.sin(phase)) * 0.024;
      const landing = distance - landedAt;
      art.dino.visible = view === "third";
      art.dino.position.x = run.xM;
      art.dino.position.y = run.heightM + bob;
      art.dino.rotation.x = air ? -run.verticalSpeedMps * 0.025 : 0;
      const laneOffset = run.lane * DINO_LANE_WIDTH - run.xM;
      art.dino.rotation.z = reducedMotion ? 0 : -Math.max(-0.15, Math.min(0.15, laneOffset * 0.17));
      art.dino.scale.y = 1 - Math.max(0, 1 - landing * 2) * 0.12;
      const evolved = run.evolutionTicks > 0;
      art.evolutionCrest.visible = evolved;
      art.green.color.setHex(evolved ? 0x9362df : 0x71944e);
      art.tail.rotation.y = Math.sin(phase * 0.56) * 0.22;
      art.legs.forEach(({ leg, foot }, index) => {
        leg.rotation.x = air ? -0.6 + index * 0.25 : Math.sin(phase + index * Math.PI) * 0.7;
        foot.rotation.x = air ? 0.35 : 0;
      });
      art.shadow.visible = view === "third" && !run.obstacles.some(({ kind, startM, lengthM }) =>
        kind === "gap" && distance >= startM && distance <= startM + lengthM,
      );
      art.shadow.position.x = run.xM;

      const third = view === "third";
      const shieldFlash = run.armorFlashTicks / DINO_ARMOR_FLASH_TICKS;
      art.shield.visible = third && (run.hasArmor || shieldFlash > 0);
      art.shield.position.x = run.xM;
      art.shield.position.y = run.heightM + 0.59;
      art.shieldMaterial.opacity = run.hasArmor ? 0.33 : shieldFlash * 0.76;
      camera.position.set(third ? run.xM * 0.6 + 0.65 : run.xM, (third ? 2.2 : 1.15) + run.heightM + (reducedMotion ? 0 : bob), third ? 3.75 : -0.64);
      camera.lookAt(third ? run.xM * 0.3 : run.xM * 0.28, third ? 0.65 + run.heightM * 0.42 : 0.48 + run.heightM * 0.72, third ? -5 : -12);

      const gaps = run.obstacles.filter(({ kind }) => kind === "gap");
      function placeSlab(slab: (typeof art.road)[number][number] | undefined, start: number, end: number) {
        if (!slab) return;
        slab.visible = end - start >= 0.015;
        if (!slab.visible) return;
        slab.position.z = distance - (start + end) / 2;
        slab.scale.z = end - start;
      }
      const firstTile = Math.floor((distance - 10) / 2.4);
      for (let offset = 0; offset < art.road.length; offset++) {
        const tile = firstTile + offset;
        const start = tile * 2.4;
        const end = start + 2.4;
        const slot = ((tile % art.road.length) + art.road.length) % art.road.length;
        const pair = art.road[slot];
        if (!pair) continue;
        const [front, back] = pair;
        const gap = gaps.find(({ startM, lengthM }) => startM < end && startM + lengthM > start);
        placeSlab(front, start, gap?.startM ?? end);
        placeSlab(back, gap ? gap.startM + gap.lengthM : end, end);
      }
      const firstBank = Math.floor(distance / 4.2) - 2;
      const firstBankSlot = ((firstBank % art.banks.length) + art.banks.length) % art.banks.length;
      art.banks.forEach((bank, index) => {
        const offset = (index - firstBankSlot + art.banks.length) % art.banks.length;
        bank.position.z = distance - (firstBank + offset) * 4.2;
      });
      art.gaps.forEach((glow, index) => {
        const gap = gaps[index];
        glow.visible = Boolean(gap);
        if (!gap) return;
        glow.position.z = distance - gap.startM - gap.lengthM / 2;
        glow.scale.z = gap.lengthM;
      });

      const rocks = run.obstacles.filter(({ kind, broken }) => kind === "boulder" && !broken);
      art.boulders.forEach(({ group, stoneBall, pebbles }, index) => {
        const obstacle = rocks[index];
        group.visible = Boolean(obstacle);
        if (!obstacle) return;
        const remaining = obstacle.startM - distance;
        const laneX = dinoObstacleCenterX(obstacle);
        const rollOffset = dinoBoulderOffsetM(obstacle, distance);
        group.position.x = laneX;
        group.position.z = -remaining - obstacle.lengthM / 2;
        stoneBall.position.x = rollOffset;
        stoneBall.rotation.z = rollOffset * 2;
        pebbles.forEach((pebble, pebbleIndex) => {
          pebble.visible = !reducedMotion && rollOffset !== 0 && remaining < DINO_BOULDER_ROLL_M + 4;
          pebble.position.x = rollOffset * (0.75 - pebbleIndex * 0.18);
          pebble.rotation.z = distance + pebbleIndex;
        });
      });
      for (const [kind, pool] of [["log", art.logs], ["pillar", art.pillars]] as const) {
        const obstacles = run.obstacles.filter((obstacle) => obstacle.kind === kind);
        pool.forEach((model, index) => {
          const obstacle = obstacles[index];
          model.visible = Boolean(obstacle);
          if (!obstacle) return;
          model.position.x = dinoObstacleCenterX(obstacle);
          model.position.z = distance - obstacle.startM - obstacle.lengthM / 2;
        });
      }

      const burst = run.fireBurst;
      const hit = burst?.hit;
      const age = burst ? 1 - burst.ticksLeft / DINO_FIRE_BURST_TICKS : 0;
      const reach = hit ? hit.atM - distance : DINO_FIRE_RANGE_M;
      const mouthY = run.heightM + 0.82;
      art.flames.forEach((flame, index) => {
        flame.visible = Boolean(burst) && reach > 0.85 && (!reducedMotion || index < 7);
        if (!flame.visible) return;
        const progress = index / (reducedMotion ? 6 : 12);
        const endX = hit?.xM ?? run.xM;
        const endY = hit ? 0.36 : mouthY + 0.12;
        const spread = (0.07 + 0.28 * progress) * (1 - age * 0.75);
        const flutter = index * 2.4 + (reducedMotion ? 0 : age * 8);
        flame.position.set(
          run.xM + (endX - run.xM) * progress + Math.sin(flutter) * spread * progress,
          mouthY + (endY - mouthY) * progress + Math.cos(flutter) * spread * progress,
          -0.84 - (reach - 0.84) * progress,
        );
        flame.scale.set(spread, spread * 0.9, Math.max(spread, reach / 13) * (1 - age * 0.45));
        flame.rotation.z = flutter;
      });
      art.debris.forEach((fragment, index) => {
        fragment.visible = Boolean(hit) && (!reducedMotion || index < 4);
        if (!hit || !fragment.visible) return;
        const angle = index * 2.4;
        const spread = 0.05 + (reducedMotion ? 0.35 : age * 1.35);
        fragment.position.set(
          hit.xM + Math.cos(angle) * spread,
          0.35 + Math.sin(Math.PI * age) * (0.35 + index * 0.06),
          distance - hit.atM + Math.sin(angle) * spread,
        );
        fragment.scale.setScalar(0.14 * (1 - 0.75 * age));
      });

      art.items.forEach(({ group, gem, material }, index) => {
        const item = run.items[index];
        group.visible = Boolean(item);
        if (!item) return;
        const oscillation = reducedMotion ? 0 : distance * 0.8 + item.id;
        group.position.set(item.lane * DINO_LANE_WIDTH, 0, distance - item.atM);
        gem.position.y = 0.54 + Math.sin(oscillation) * 0.09;
        gem.rotation.y = oscillation;
        gem.geometry = item.kind === "fire" || item.kind === "armor"
          ? art.pickupShapes[item.kind]
          : art.pickupShapes.gem;
        gem.scale.y = item.kind === "fire" ? 0.62 : 0.34;
        material.color.setHex(ITEM_COLORS[item.kind]);
      });

      art.dustMaterial.opacity = !reducedMotion && landing < 2.2 ? (1 - landing / 2.2) * 0.55 : 0;
      art.dust.forEach((particle, index) => {
        particle.visible = art.dustMaterial.opacity > 0;
        particle.position.set(landedX + Math.cos(index * 2.4) * (0.22 + landing * 0.29), 0.06 + landing * 0.1, landing + Math.sin(index * 2.4) * 0.28);
      });
      art.ash.forEach((particle, index) => {
        particle.visible = !reducedMotion || index < 5;
        const drift = reducedMotion ? 0 : distance * 0.12;
        particle.position.set(((index * 2.73 + drift) % 12) - 6, 0.4 + (index * 0.47) % 4, -((index * 4.1 - distance % 44 + 44) % 44));
      });
      art.smoke.forEach((puff, index) => {
        puff.position.x = -6 + index * 1.72 + (reducedMotion ? 0 : Math.sin(distance * 0.11 + index) * 0.75);
      });
      if (map === "volcano" && !reducedMotion) {
        art.floorMaterial.emissiveIntensity = 0.65 + Math.sin(distance * 0.28) * 0.12;
      }
      redraw();
    },
    dispose() {
      observer.disconnect();
      const geometries = new Set<Mesh["geometry"]>();
      const materials = new Set<Material>();
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material: Material) => materials.add(material));
        else materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      art.rockMap?.dispose();
      sky?.dispose();
      renderer.dispose();
    },
  };
}
