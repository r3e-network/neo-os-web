using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformAnchorContract
    {
        public static void Stake(string appId, UInt160 user, BigInteger amount)
        {
            StakeFromCredit(appId, user, amount);
        }

        public static void Withdraw(string appId, UInt160 user, BigInteger amount)
        {
            ValidateRegistered(appId);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ValidateAddress(user);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            AccrueUserRewards(appId, user);
            BigInteger previousStake = GetUserStake(appId, user);
            ExecutionEngine.Assert(previousStake >= amount, "insufficient stake");

            BigInteger nextStake = previousStake - amount;
            BigInteger nextTotal = GetTotalStaked(appId) - amount;
            Put(AppKey(appId, PREFIX_USER_STAKE, user), nextStake);
            Put(AppKey(appId, PREFIX_TOTAL_STAKED), nextTotal);
            Put(AppKey(appId, PREFIX_USER_REWARD_DEBT, user), nextStake * GetRewardPerNeo(appId));
            if (nextStake == 0)
            {
                Put(AppKey(appId, PREFIX_TOTAL_STAKERS), GetTotalStakers(appId) - 1);
            }

            ExecutionEngine.Assert(
                TransferStakedNeoBackToUser(appId, user, amount),
                "NEO transfer failed");

            OnAnchorStakeChanged(appId, user, nextStake, nextTotal);
        }

        public static void HarvestRewards(string appId, BigInteger amount)
        {
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");
            BigInteger totalStaked = GetTotalStaked(appId);
            ExecutionEngine.Assert(totalStaked > 0, "no stake");
            ExecutionEngine.Assert(
                GAS.BalanceOf(Runtime.ExecutingScriptHash) >= GetTotalRewardReserve() + GetTotalGasCredit() + amount,
                "insufficient available GAS");

            BigInteger rewardPerNeo = DistributeRewards(appId, amount, totalStaked);

            OnAnchorRewardsHarvested(appId, amount, rewardPerNeo);
        }

        public static void FundRewards(string appId, UInt160 funder, BigInteger amount)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(funder);
            ExecutionEngine.Assert(Runtime.CheckWitness(funder), "funder witness required");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");
            ConsumeGasCredit(funder, amount);
            BigInteger totalStaked = GetTotalStaked(appId);
            ExecutionEngine.Assert(totalStaked > 0, "no stake");

            BigInteger rewardPerNeo = DistributeRewards(appId, amount, totalStaked);

            OnAnchorRewardsHarvested(appId, amount, rewardPerNeo);
        }

        public static void ClaimRewards(string appId, UInt160 user)
        {
            ValidateRegistered(appId);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ValidateAddress(user);

            AccrueUserRewards(appId, user);
            BigInteger scaledPending = GetBigInteger(AppKey(appId, PREFIX_USER_PENDING_REWARD, user));
            BigInteger amount = scaledPending / REWARD_SCALE;
            ExecutionEngine.Assert(amount > 0, "no rewards");
            ExecutionEngine.Assert(GetRewardReserve(appId) >= amount, "reward reserve short");

            BigInteger remainingScaled = scaledPending - amount * REWARD_SCALE;
            if (remainingScaled == 0) Delete(AppKey(appId, PREFIX_USER_PENDING_REWARD, user));
            else Put(AppKey(appId, PREFIX_USER_PENDING_REWARD, user), remainingScaled);
            Put(AppKey(appId, PREFIX_REWARD_RESERVE), GetRewardReserve(appId) - amount);
            PutTotalRewardReserve(GetTotalRewardReserve() - amount);
            ExecutionEngine.Assert(
                TransferRewardGasToUser(appId, user, amount),
                "GAS transfer failed");

            OnAnchorRewardsClaimed(appId, user, amount);
        }

        public static void WithdrawCredit(UInt160 user, string asset, BigInteger amount)
        {
            ValidateAddress(user);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            if (asset == "NEO")
            {
                ConsumeCredit(PREFIX_NEO_CREDIT, user, amount);
                ExecutionEngine.Assert(
                    NEO.Transfer(Runtime.ExecutingScriptHash, user, amount),
                    "NEO credit transfer failed");
                return;
            }

            if (asset == "GAS")
            {
                ConsumeGasCredit(user, amount);
                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, user, amount),
                    "GAS credit transfer failed");
                return;
            }

            ExecutionEngine.Assert(false, "invalid asset");
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || from == UInt160.Zero) return;
            if (from == Runtime.ExecutingScriptHash) return;
            ValidateAddress(from);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                AddCredit(PREFIX_NEO_CREDIT, from, amount);
                if (data is string)
                {
                    string appId = (string)data;
                    if (appId.Length > 0)
                    {
                        StakeFromCredit(appId, from, amount);
                    }
                }
                return;
            }

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                AddGasCredit(from, amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }
    }
}
