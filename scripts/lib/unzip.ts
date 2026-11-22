// Extraction minimale d'une archive ZIP (méthodes « stockée » et « deflate »), sans dépendance :
// suffit pour les fichiers de GeoNames.
import { inflateRawSync } from 'node:zlib';

export function unzipEntries(zip: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  // Le répertoire central (fin de l'archive) donne la taille compressée fiable de chaque fichier.
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Archive ZIP invalide (répertoire central introuvable)');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Archive ZIP invalide (entrée centrale)');
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = zip.subarray(start, start + compressedSize);
    if (method === 0) entries.set(name, Buffer.from(data));
    else if (method === 8) entries.set(name, inflateRawSync(data));
    else throw new Error(`Méthode de compression ZIP non prise en charge : ${method}`);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
