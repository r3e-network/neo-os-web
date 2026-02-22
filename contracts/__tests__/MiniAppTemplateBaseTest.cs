using System;
using System.Collections.Generic;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;
using Neo.VM;
using NeoTestEngine;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Tests for MiniAppTemplate.Base - Generic Template Base Contract
    /// 
    /// Test Coverage:
    /// - Template Configuration Initialization
    /// - Operation Definition Management
    /// - Permission Check
    /// - State Storage/Reading
    /// - Player Data Management
    /// - Metadata Management
    /// </summary>
    public class MiniAppTemplateBaseTest
    {
        private readonly TestEngine _engine;
        private readonly UInt160 _admin;
        private readonly UInt160 _player;
        private readonly UInt160 _someone;

        public MiniAppTemplateBaseTest()
        {
            _engine = new TestEngine();
            _admin = GenerateHash(1);
            _player = GenerateHash(2);
            _someone = GenerateHash(3);
        }

        #region Helper Methods

        private UInt160 GenerateHash(int seed)
        {
            var bytes = new byte[20];
            var seedBytes = BitConverter.GetBytes(seed);
            Buffer.BlockCopy(seedBytes, 0, bytes, 0, seedBytes.Length);
            return new UInt160(bytes);
        }

        private TemplateConfig CreateTestConfig()
        {
            var operations = new OperationDef[]
            {
                new OperationDef
                {
                    Name = "Play",
                    Method = "play",
                    GasCost = 1000000,
                    RequiresWitness = true,
                    ParamSchema = (ByteString)"{\"amount\": \"integer\"}",
                    Description = "Play the game"
                },
                new OperationDef
                {
                    Name = "Claim",
                    Method = "claim",
                    GasCost = 500000,
                    RequiresWitness = false,
                    ParamSchema = (ByteString)"",
                    Description = "Claim rewards"
                }
            };

            var permissions = new Permission[]
            {
                new Permission { Key = "payments", Enabled = true },
                new Permission { Key = "datafeed", Enabled = false },
                new Permission { Key = "nft", Enabled = true }
            };

            return new TemplateConfig
            {
                Name = "Test MiniApp",
                Description = "Test Description",
                Version = "1.0.0",
                Operations = (ByteString)StdLib.Serialize(operations),
                CustomParams = (ByteString)"{\"minAmount\": 10000000, \"maxAmount\": 1000000000}",
                Permissions = (ByteString)StdLib.Serialize(permissions),
                CreatedAt = 0,
                CreatedBy = UInt160.Zero
            };
        }

        private byte[] CreateInitScript(TemplateConfig config)
        {
            var script = new ScriptBuilder();
            script.Call(0, "InitializeTemplate", new object[] { StdLib.Serialize(config) });
            return script.ToArray();
        }

        #endregion

        #region Template Configuration Tests

        [Fact]
        public void Test_GetConfig_ReturnsEmptyWhenNotInitialized()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            
            // Act
            var result = contract.GetConfig();
            
            // Assert
            Assert.Null(result.Name);
        }

        [Fact]
        public void Test_GetConfig_ReturnsInitializedConfig()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act
            var result = contract.GetConfig();
            
            // Assert
            Assert.Equal(config.Name, result.Name);
            Assert.Equal(config.Description, result.Description);
            Assert.Equal(config.Version, result.Version);
        }

        [Fact]
        public void Test_GetRawConfig_ReturnsSerializedData()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act
            var raw = contract.GetRawConfig();
            
            // Assert
            Assert.NotNull(raw);
            Assert.True(raw.Length > 0);
        }

        [Fact]
        public void Test_InitializeTemplate_SetsCreatedByAndCreatedAt()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            
            // Act
            contract.InitializeTemplate(StdLib.Serialize(config));
            var result = contract.GetConfig();
            
            // Assert
            Assert.Equal(_admin, result.CreatedBy);
            Assert.True(result.CreatedAt > 0);
        }

        [Fact]
        public void Test_InitializeTemplate_OnlyAdminCanCall()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_someone); // Not admin
            
            // Act & Assert
            Assert.Throws<VMException>(() => 
                contract.InitializeTemplate(StdLib.Serialize(config)));
        }

        #endregion

        #region Operation Definition Tests

        [Fact]
        public void Test_GetOperations_ReturnsEmptyWhenNoOperations()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            
            // Act
            var result = contract.GetOperations();
            
            // Assert
            Assert.NotNull(result);
            Assert.Empty(result);
        }

        [Fact]
        public void Test_GetOperations_ReturnsDeserializedOperations()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act
            var operations = contract.GetOperations();
            
            // Assert
            Assert.Equal(2, operations.Length);
            Assert.Equal("play", operations[0].Method);
            Assert.Equal("claim", operations[1].Method);
        }

        [Fact]
        public void Test_GetOperation_ReturnsCorrectOperation()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act
            var playOp = contract.GetOperation("play");
            var claimOp = contract.GetOperation("claim");
            var invalidOp = contract.GetOperation("nonexistent");
            
            // Assert
            Assert.Equal("Play", playOp.Name);
            Assert.Equal("play", playOp.Method);
            Assert.Equal(1000000, playOp.GasCost);
            Assert.True(playOp.RequiresWitness);
            
            Assert.Equal("Claim", claimOp.Name);
            Assert.Equal(500000, claimOp.GasCost);
            Assert.False(claimOp.RequiresWitness);
            
            Assert.Null(invalidOp.Method);
        }

        [Fact]
        public void Test_ValidateOperation_ThrowsForNonExistent()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act & Assert
            Assert.Throws<VMException>(() => 
                contract.ValidateOperation("nonexistent", _player));
        }

        [Fact]
        public void Test_ValidateOperation_RequiresWitnessWhenConfigured()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act & Assert - play operation requires witness
            Assert.Throws<VMException>(() => 
                contract.ValidateOperation("play", _someone)); // Not witness
        }

        #endregion

        #region Permission Tests

        [Fact]
        public void Test_HasPermission_ReturnsFalseWhenNoPermissions()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            
            // Act
            var result = contract.HasPermission("payments");
            
            // Assert
            Assert.False(result);
        }

        [Fact]
        public void Test_HasPermission_ReturnsCorrectValue()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            // Act
            var paymentsEnabled = contract.HasPermission("payments");
            var datafeedEnabled = contract.HasPermission("datafeed");
            var nftEnabled = contract.HasPermission("nft");
            var unknownPermission = contract.HasPermission("unknown");
            
            // Assert
            Assert.True(paymentsEnabled);
            Assert.False(datafeedEnabled);
            Assert.True(nftEnabled);
            Assert.False(unknownPermission);
        }

        #endregion

        #region State Storage Tests

        [Fact]
        public void Test_GetNextId_IncrementsCounter()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            var prefix = new byte[] { 0x34 };
            
            // Act
            var id1 = contract.GetNextId(prefix);
            var id2 = contract.GetNextId(prefix);
            var id3 = contract.GetNextId(prefix);
            
            // Assert
            Assert.Equal(1, id1);
            Assert.Equal(2, id2);
            Assert.Equal(3, id3);
        }

        [Fact]
        public void Test_ValidateAndGetAmount_ValidatesRange()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            var minAmount = 10000000;
            var maxAmount = 100000000;
            
            // Act & Assert - Valid amounts
            var result1 = contract.ValidateAndGetAmount(minAmount, minAmount, maxAmount);
            var result2 = contract.ValidateAndGetAmount(maxAmount, minAmount, maxAmount);
            var result3 = contract.ValidateAndGetAmount(50000000, minAmount, maxAmount);
            
            Assert.Equal(minAmount, result1);
            Assert.Equal(maxAmount, result2);
            Assert.Equal(50000000, result3);
            
            // Assert - Invalid amounts
            Assert.Throws<VMException>(() => 
                contract.ValidateAndGetAmount(minAmount - 1, minAmount, maxAmount));
            Assert.Throws<VMException>(() => 
                contract.ValidateAndGetAmount(maxAmount + 1, minAmount, maxAmount));
        }

        #endregion

        #region Player Data Tests

        [Fact]
        public void Test_GetPlayerData_ReturnsEmptyWhenNotSet()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            var prefix = new byte[] { 0x32 };
            
            // Act
            var result = contract.GetPlayerData(_player, prefix);
            
            // Assert
            Assert.Null(result);
        }

        [Fact]
        public void Test_SetAndGetPlayerData()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            var prefix = new byte[] { 0x32 };
            var testData = (ByteString)"{\"score\": 100, \"level\": 5}";
            
            // Act
            contract.SetPlayerData(_player, prefix, testData);
            var result = contract.GetPlayerData(_player, prefix);
            
            // Assert
            Assert.Equal(testData, result);
        }

        [Fact]
        public void Test_DeletePlayerData()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            var prefix = new byte[] { 0x32 };
            var testData = (ByteString)"{\"score\": 100}";
            
            // Act
            contract.SetPlayerData(_player, prefix, testData);
            var beforeDelete = contract.GetPlayerData(_player, prefix);
            contract.DeletePlayerData(_player, prefix);
            var afterDelete = contract.GetPlayerData(_player, prefix);
            
            // Assert
            Assert.Equal(testData, beforeDelete);
            Assert.Null(afterDelete);
        }

        #endregion

        #region Metadata Tests

        [Fact]
        public void Test_SetAndGetMetadata()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            var key = "testKey";
            var value = (ByteString)"testValue";
            
            // Act
            contract.SetMetadata(key, value);
            var result = contract.GetMetadata(key);
            
            // Assert
            Assert.Equal(value, result);
        }

        [Fact]
        public void Test_GetMetadata_ReturnsEmptyForNonExistent()
        {
            // Arrange
            var contract = _engine.InsertContract<MiniAppTemplate>();
            
            // Act
            var result = contract.GetMetadata("nonexistent");
            
            // Assert
            Assert.Equal((ByteString)"", result);
        }

        [Fact]
        public void Test_UpdateConfig_OnlyAdminCanCall()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            var newConfig = CreateTestConfig();
            newConfig.Name = "Updated Name";
            
            // Act & Assert
            contract.SetObserver(_someone); // Not admin
            Assert.Throws<VMException>(() => 
                contract.UpdateConfig(newConfig));
        }

        [Fact]
        public void Test_UpdateConfig_PreservesCreatedByAndCreatedAt()
        {
            // Arrange
            var config = CreateTestConfig();
            var contract = _engine.InsertContract<MiniAppTemplate>();
            contract.SetObserver(_admin);
            contract.InitializeTemplate(StdLib.Serialize(config));
            
            var originalConfig = contract.GetConfig();
            var originalCreatedAt = originalConfig.CreatedAt;
            var originalCreatedBy = originalConfig.CreatedBy;
            
            var newConfig = CreateTestConfig();
            newConfig.Name = "Updated Name";
            
            // Act
            contract.UpdateConfig(newConfig);
            var updatedConfig = contract.GetConfig();
            
            // Assert
            Assert.Equal("Updated Name", updatedConfig.Name);
            Assert.Equal(originalCreatedAt, updatedConfig.CreatedAt);
            Assert.Equal(originalCreatedBy, updatedConfig.CreatedBy);
        }

        #endregion
    }
}
