function toBigIntBalance(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  const text = String(value ?? "0").trim();
  if (!text) return 0n;
  return BigInt(text);
}

function describeCandidate(candidate) {
  return `${candidate.label || "actor"} ${candidate.address || "(unknown)"} has ${toBigIntBalance(candidate.neo).toString()} NEO`;
}

function chooseNeoCapableActor(candidates, requiredNeo) {
  const required = toBigIntBalance(requiredNeo);
  const configured = candidates.filter((candidate) => candidate?.account || candidate?.address);
  for (const candidate of configured) {
    if (toBigIntBalance(candidate.neo) >= required) {
      return candidate;
    }
  }
  throw new Error(
    `no configured actor has the required ${required.toString()} NEO; ${configured.map(describeCandidate).join("; ")}`
  );
}

module.exports = {
  chooseNeoCapableActor,
  toBigIntBalance,
};
