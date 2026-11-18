import { BOARD } from "@nha-choi/game-core";
import type { PlayerView } from "@nha-choi/game-core";
import photos from "../locations.json";
import { Dialog } from "./Dialog.js";
export function LocationPhoto({ spaceId }: { spaceId: number }) {
  const photo = photos[String(spaceId) as keyof typeof photos];
  if (!photo) return null;
  return (
    <figure className="location-figure">
      <img className="location-photo" src={photo.src} alt={photo.caption} />
      <figcaption className="photo-credit">
        <span className="photo-caption">{photo.caption}</span>
        <span className="photo-attribution">
          Ảnh: {photo.author} ·{" "}
          <a href={photo.source} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>{" "}
          ·{" "}
          <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
            {photo.license}
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
export function LocationDetails({
  spaceId,
  view,
  onClose,
}: {
  spaceId: number;
  view: PlayerView;
  onClose: () => void;
}) {
  const space = BOARD[spaceId]!;
  const property = view.board[spaceId]!;
  const owner = view.players.find((p) => p.id === property.owner);
  return (
    <Dialog title={space.name} onClose={onClose}>
      <LocationPhoto spaceId={spaceId} />
      <span className="tag green">
        {owner
          ? `Tài sản của ${owner.name}`
          : space.price
            ? "Chưa có chủ"
            : "Ô chức năng"}
      </span>
      <h2>{space.name}</h2>
      <dl className="property-prices">
        {space.price && (
          <>
            <div>
              <dt>Giá niêm yết</dt>
              <dd>{space.price}</dd>
            </div>
            <div>
              <dt>Thế chấp</dt>
              <dd>{space.mortgage}</dd>
            </div>
          </>
        )}
        {space.buildCost && (
          <div>
            <dt>Giá mỗi công trình</dt>
            <dd>{space.buildCost}</dd>
          </div>
        )}
        {property.owner && (
          <>
            <div>
              <dt>Công trình</dt>
              <dd>
                {property.buildings === 5
                  ? "Khách sạn"
                  : `${property.buildings} nhà`}
              </dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{property.mortgaged ? "Đang thế chấp" : "Chưa thế chấp"}</dd>
            </div>
          </>
        )}
        {space.rent?.map((rent, index) => (
          <div key={index}>
            <dt>
              {index === 0
                ? "Tiền thuê nền"
                : index === 5
                  ? "Khách sạn"
                  : `${index} nhà`}
            </dt>
            <dd>{rent}</dd>
          </div>
        ))}
      </dl>
      {!space.price && (
        <p className="dialog-lead">
          {space.kind === "tax"
            ? `Nộp thuế ${space.tax} cho ngân hàng.`
            : space.kind === "go"
              ? "Đi qua hoặc tới đây theo chiều tiến, nhận 200."
              : space.kind === "parking"
                ? "Dừng chân miễn phí, không có tiền thưởng."
                : space.kind === "go-to-jail"
                  ? "Vào tù ngay, không nhận lương Xuất phát."
                  : space.kind === "jail"
                    ? "Ghé thăm hoặc chấp hành lượt trong tù."
                    : "Rút một thẻ và làm theo nội dung."}
        </p>
      )}
      <button className="button primary full" onClick={onClose}>
        Trở lại bàn chơi
      </button>
    </Dialog>
  );
}
