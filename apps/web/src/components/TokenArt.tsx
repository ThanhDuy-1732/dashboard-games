import type { Token } from "@nha-choi/game-core";

export const TOKEN_NAMES: Record<Token, string> = {
  car: "Ô tô",
  cat: "Mèo",
  hat: "Mũ",
  ship: "Thuyền",
  dog: "Chó",
  plane: "Máy bay",
  rocket: "Tên lửa",
  bike: "Xe đạp",
  robot: "Robot",
  butterfly: "Bướm",
  camera: "Máy ảnh",
  guitar: "Đàn guitar",
  cyclo: "Xích lô",
  "conical-hat": "Nón lá",
  lotus: "Hoa sen",
  scooter: "Xe máy",
  carp: "Cá chép",
  lantern: "Đèn lồng",
};

export function TokenArt({ token }: { token: Token }) {
  return (
    <img
      className="token-art"
      data-token={token}
      src={`${import.meta.env.BASE_URL}tokens/${token}.png`}
      alt=""
      width={96}
      height={96}
      draggable={false}
    />
  );
}
