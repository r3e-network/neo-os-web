# UniversalMiniApp Contract

通用小程序合约 - 让开发者无需部署自己的合约即可构建 MiniApp。

## 概述

UniversalMiniApp 是一个共享合约，所有 MiniApp 都可以使用它来：

- 存储应用数据
- 处理支付
- 获取随机数
- 发射事件

**开发者只需关注前端代码**，无需编写或部署智能合约。

## 快速开始

### 1. 创建 MiniApp 目录

```bash
mkdir miniapps-uniapp/apps/my-app
```

### 2. 创建 neo-manifest.json

```json
{
  "category": "utility",
  "name": "My App",
  "name_zh": "我的应用",
  "description": "My awesome MiniApp",
  "description_zh": "我的精彩小程序",
  "status": "active",
  "permissions": {
    "payments": true
  }
}
```

### 3. 自动发现

运行自动发现脚本，MiniApp 将自动注册：

```bash
node platform/host-app/scripts/auto-discover-miniapps.js
```

## 功能特性

- **App 注册**: 注册 app_id，成为 owner
- **隔离存储**: 按 app_id 隔离的 Key-Value 存储
- **服务调用**: 随机数、价格预言机等
- **事件发射**: 自定义事件和指标

## API

### 注册

```csharp
RegisterApp(string appId)      // 注册新 app
UnregisterApp(string appId)    // 注销 app
IsAppRegistered(string appId)  // 检查是否已注册
GetAppOwner(string appId)      // 获取 owner 地址
```

### 存储

```csharp
SetValue(string appId, string key, ByteString value)
GetValue(string appId, string key)
```

### 服务

```csharp
RequestRandom(string appId)    // 请求随机数
GetPrice(string symbol)        // 获取价格
```

### 事件

```csharp
EmitAppEvent(string appId, string eventType, ByteString data)
EmitMetric(string appId, string name, BigInteger value)
```

## 安全模型

1. **App 隔离**: 每个 app_id 有独立的存储命名空间
2. **Gateway Only**: 业务方法只能由 ServiceLayerGateway 调用
3. **Owner 验证**: 只有 owner 可以注销 app

## 编译

```bash
cd contracts/UniversalMiniApp
dotnet build
```
