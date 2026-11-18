const HEADER = 13,
  MAX_MESSAGE = 32768,
  TTL = 10000;
export class BleFrameError extends Error {
  constructor(public code: "INVALID_FRAME" | "LIMIT_EXCEEDED") {
    super(code);
    this.name = "BleFrameError";
  }
}
const invalid = () => new BleFrameError("INVALID_FRAME");
export function fragmentBleMessage(
  message: Uint8Array,
  messageId: number,
  maxPayloadBytes: number,
): Uint8Array[] {
  if (
    !(message instanceof Uint8Array) ||
    !message.length ||
    message.length > MAX_MESSAGE ||
    !Number.isInteger(messageId) ||
    messageId < 0 ||
    messageId > 0xffffffff ||
    !Number.isInteger(maxPayloadBytes) ||
    maxPayloadBytes <= HEADER ||
    maxPayloadBytes > 512
  )
    throw invalid();
  const width = maxPayloadBytes - HEADER,
    count = Math.ceil(message.length / width),
    frames: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const chunk = message.subarray(index * width, (index + 1) * width),
      frame = new Uint8Array(HEADER + chunk.length),
      header = new DataView(frame.buffer);
    header.setUint8(0, 1);
    header.setUint32(1, messageId);
    header.setUint16(5, index);
    header.setUint16(7, count);
    header.setUint32(9, message.length);
    frame.set(chunk, HEADER);
    frames.push(frame);
  }
  return frames;
}
interface PartialMessage {
  created: number;
  total: number;
  count: number;
  bytes: number;
  chunks: Map<number, Uint8Array>;
}
interface Peer {
  partial: Map<number, PartialMessage>;
  completed: Map<number, { created: number; total: number; count: number }>;
}
export class BleReassembler {
  private peers = new Map<string, Peer>();
  constructor(private now: () => number = () => Date.now()) {}
  expire() {
    for (const [peerId, peer] of this.peers) {
      for (const [id, part] of peer.partial)
        if (this.now() - part.created >= TTL) peer.partial.delete(id);
      for (const [id, part] of peer.completed)
        if (this.now() - part.created >= TTL) peer.completed.delete(id);
      if (!peer.partial.size && !peer.completed.size) this.peers.delete(peerId);
    }
  }
  dropPeer(peerId: string) {
    this.peers.delete(peerId);
  }
  clear() {
    this.peers.clear();
  }
  accept(peerId: string, frame: Uint8Array): Uint8Array | null {
    this.expire();
    if (
      typeof peerId !== "string" ||
      !peerId.length ||
      peerId.length > 128 ||
      !(frame instanceof Uint8Array) ||
      frame.length <= HEADER ||
      frame.length > 512
    )
      throw invalid();
    const header = new DataView(
        frame.buffer,
        frame.byteOffset,
        frame.byteLength,
      ),
      version = header.getUint8(0),
      id = header.getUint32(1),
      index = header.getUint16(5),
      count = header.getUint16(7),
      total = header.getUint32(9);
    if (
      version !== 1 ||
      !count ||
      index >= count ||
      !total ||
      total > MAX_MESSAGE ||
      count > total ||
      frame.length - HEADER > total
    )
      throw invalid();
    let peer = this.peers.get(peerId);
    if (!peer) {
      if (this.peers.size >= 6) throw new BleFrameError("LIMIT_EXCEEDED");
      peer = { partial: new Map(), completed: new Map() };
      this.peers.set(peerId, peer);
    }
    const completed = peer.completed.get(id);
    if (completed) {
      if (completed.total !== total || completed.count !== count)
        throw invalid();
      return null;
    }
    let part = peer.partial.get(id);
    if (!part) {
      if (peer.partial.size >= 2) throw new BleFrameError("LIMIT_EXCEEDED");
      part = { created: this.now(), total, count, bytes: 0, chunks: new Map() };
      peer.partial.set(id, part);
    }
    if (part.total !== total || part.count !== count) {
      peer.partial.delete(id);
      throw invalid();
    }
    const bytes = frame.subarray(HEADER),
      previous = part.chunks.get(index);
    if (previous) {
      if (
        previous.length !== bytes.length ||
        previous.some((value, i) => value !== bytes[i])
      ) {
        peer.partial.delete(id);
        throw invalid();
      }
      return null;
    }
    if (part.bytes + bytes.length > total) {
      peer.partial.delete(id);
      throw invalid();
    }
    part.chunks.set(index, bytes.slice());
    part.bytes += bytes.length;
    if (part.chunks.size !== count) return null;
    peer.partial.delete(id);
    if (part.bytes !== total) throw invalid();
    const message = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < count; i++) {
      const chunk = part.chunks.get(i)!;
      message.set(chunk, offset);
      offset += chunk.length;
    }
    peer.completed.set(id, { created: this.now(), total, count });
    if (peer.completed.size > 1024)
      peer.completed.delete(peer.completed.keys().next().value!);
    return message;
  }
}
