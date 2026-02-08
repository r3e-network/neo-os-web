using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace RedEnvelope.Contract
{
    /// <summary>
    /// NEP-11 token state for red envelope NFTs.
    /// Immutable metadata stored via Nep11Token base class.
    /// </summary>
    public class RedEnvelopeState : Nep11TokenState
    {
        public BigInteger EnvelopeId;
        public UInt160 Creator;
        public BigInteger TotalAmount;
        public BigInteger PacketCount;
        public string Message;
        public BigInteger EnvelopeType;
        public BigInteger ParentEnvelopeId;
    }
}
