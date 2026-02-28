pragma circom 2.0.0;

import "node_modules/circomlib/circuits/poseidon.circom";
import "node_modules/circomlib/circuits/mux1.circom";

// Computes Poseidon(left, right)
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// Verifies that a leaf is in the Merkle Tree at the given path
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    signal currentHash[levels + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Ensure pathIndex is 0 or 1
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        selectors[i] = MultiMux1(2);
        selectors[i].c[0][0] <== currentHash[i];
        selectors[i].c[0][1] <== pathElements[i];

        selectors[i].c[1][0] <== pathElements[i];
        selectors[i].c[1][1] <== currentHash[i];

        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];

        currentHash[i + 1] <== hashers[i].hash;
    }

    root === currentHash[levels];
}

// The main zNEP17 Withdrawal Circuit
template Withdraw(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayerFee;

    // Private inputs
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Verify the Nullifier Hash is correctly derived: Poseidon(nullifier)
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.out === nullifierHash;

    // 2. Compute the Commitment: Poseidon(secret, nullifier)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== nullifier;

    // 3. Verify the Commitment is in the Merkle Tree
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitmentHasher.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 4. Bind the public inputs (recipient & fee) to the proof
    // We add a dummy constraint so the compiler does not optimize them away.
    // By squaring them, they become part of the SNARK proof generation,
    // ensuring a malicious relayer cannot intercept the proof and change the recipient/fee.
    signal recipientSquare;
    signal feeSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== relayerFee * relayerFee;
}

// Instantiate the component with a tree depth of 20 (allowing for ~1,000,000 deposits)
component main { public [root, nullifierHash, recipient, relayerFee] } = Withdraw(20);
