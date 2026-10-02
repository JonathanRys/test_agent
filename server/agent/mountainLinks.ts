export type MountainCardReference = {
  id: number;
  name: string;
};

export function collectMountainCardReferences(
  serializedToolResult: string,
): MountainCardReference[] {
  try {
    const response = JSON.parse(serializedToolResult) as {
      result?: unknown;
    };
    const result = response.result;
    const candidates = Array.isArray(result)
      ? result
      : result && typeof result === "object" &&
          Array.isArray((result as { mountains?: unknown }).mountains)
        ? (result as { mountains: unknown[] }).mountains
        : result && typeof result === "object"
          ? [result]
          : [];

    return candidates.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const { id, name } = candidate as { id?: unknown; name?: unknown };
      if (
        typeof id !== "number" ||
        !Number.isInteger(id) ||
        typeof name !== "string" ||
        !name.trim()
      ) {
        return [];
      }
      return [{ id, name: name.trim() }];
    });
  } catch {
    return [];
  }
}

export function linkMountainCards(
  content: string,
  references: MountainCardReference[],
): string {
  const mountainByName = new Map<string, number>();
  for (const reference of references) {
    const normalizedName = reference.name.toLocaleLowerCase();
    if (!mountainByName.has(normalizedName)) {
      mountainByName.set(normalizedName, reference.id);
    }
  }
  if (mountainByName.size === 0) return content;

  const names = [...mountainByName.keys()].sort(
    (left, right) => right.length - left.length,
  );
  const alternatives = names.map(escapeRegExp).join("|");
  const mountainPattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${alternatives})(?=$|[^\\p{L}\\p{N}_])`,
    "giu",
  );
  const markdownLinkOrCode =
    /(\[[^\]]+\]\([^)]+\)|```[\s\S]*?```|`[^`\n]*`)/g;

  return content
    .split(markdownLinkOrCode)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(mountainPattern, (match, prefix: string, name: string) => {
        const id = mountainByName.get(name.toLocaleLowerCase());
        return id === undefined ? match : `${prefix}[${name}](/mountain/${id})`;
      });
    })
    .join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}