/**
 * Dark Pool Vote Aggregator
 * Runs in TEE to privately aggregate encrypted votes
 */

function aggregateVotes() {
  const { proposalId, votes } = input;

  let yesCount = 0;
  let noCount = 0;
  let totalWeight = 0;

  for (const vote of votes) {
    const weight = vote.weight || 1;
    totalWeight += weight;

    if (vote.choice === "yes") {
      yesCount += weight;
    } else {
      noCount += weight;
    }
  }

  return {
    proposalId,
    yesCount,
    noCount,
    totalWeight,
    result: yesCount > noCount ? "passed" : "rejected",
    hash: crypto.sha256(JSON.stringify({ yesCount, noCount })),
  };
}
