#!/usr/bin/env python3
"""
Deploy platform + MiniApp contracts to Neo N3 mainnet and update mainnet_contracts.json.

Usage:
  python3 deploy/scripts/deploy_mainnet_contracts.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD_DIR = ROOT / "contracts" / "build"
CONFIG_PATH = ROOT / "deploy" / "config" / "mainnet_contracts.json"
TESTNET_CONFIG_PATH = ROOT / "deploy" / "config" / "testnet_contracts.json"
WALLET_CONFIG = ROOT / "deploy" / "mainnet" / "wallets" / "wallet-config.yaml"

HASH_PATTERN = re.compile(r"(0x)?[a-fA-F0-9]{40}")
TX_PATTERN = re.compile(r"(0x)?[a-fA-F0-9]{64}")


def load_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")
    return (result.stdout or "") + (result.stderr or "")


def calc_hash(nef: Path, manifest: Path, sender: str) -> str:
    output = run(
        [
            "neo-go",
            "contract",
            "calc-hash",
            "--in",
            str(nef),
            "-m",
            str(manifest),
            "-s",
            sender,
        ]
    )
    match = HASH_PATTERN.search(output)
    if not match:
        raise RuntimeError(f"Could not parse contract hash from: {output}")
    value = match.group(0)
    return value if value.startswith("0x") else f"0x{value}"


def deploy(nef: Path, manifest: Path, rpc: str) -> tuple[str, str]:
    output = run(
        [
            "neo-go",
            "contract",
            "deploy",
            "-r",
            rpc,
            "--wallet-config",
            str(WALLET_CONFIG),
            "--force",
            "--await",
            "--timeout",
            "120s",
            "-i",
            str(nef),
            "-m",
            str(manifest),
        ]
    )
    tx_match = TX_PATTERN.search(output)
    if tx_match:
        value = tx_match.group(0)
        tx_hash = value if value.startswith("0x") else f"0x{value}"
    else:
        tx_hash = ""
    return output, tx_hash


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    env = load_env(ROOT / ".env")
    sender = os.getenv("NEO_MAINNET_ADDRESS") or env.get("NEO_MAINNET_ADDRESS")
    if not sender:
        raise RuntimeError("NEO_MAINNET_ADDRESS is required (set in .env or env).")

    config = load_json(CONFIG_PATH)
    testnet_config = load_json(TESTNET_CONFIG_PATH)
    rpc = os.getenv("NEO_MAINNET_RPC") or os.getenv("NEO_RPC_URL")
    if not rpc:
        endpoints = config.get("rpc_endpoints") or ["https://mainnet1.neo.coz.io:443"]
        rpc = endpoints[0]

    platform_templates = testnet_config.get("contracts", {})
    miniapp_templates = testnet_config.get("miniapp_contracts", {})

    platform_contracts = [
        ("PaymentHub", "PaymentHubV2.nef", "PaymentHubV2.manifest.json"),
        ("Governance", "Governance.nef", "Governance.manifest.json"),
        ("PriceFeed", "PriceFeed.nef", "PriceFeed.manifest.json"),
        ("RandomnessLog", "RandomnessLog.nef", "RandomnessLog.manifest.json"),
        ("AppRegistry", "AppRegistry.nef", "AppRegistry.manifest.json"),
        ("AutomationAnchor", "AutomationAnchor.nef", "AutomationAnchor.manifest.json"),
        ("ServiceLayerGateway", "ServiceLayerGateway.nef", "ServiceLayerGateway.manifest.json"),
        ("PauseRegistry", "PauseRegistry.nef", "PauseRegistry.manifest.json"),
        ("ForeverAlbum", "ForeverAlbum.nef", "ForeverAlbum.manifest.json"),
    ]

    build_nefs = {p.stem for p in BUILD_DIR.glob("*.nef")}
    miniapps = []
    for name in sorted(build_nefs):
        if not name.startswith("MiniApp") or name == "MiniAppBase":
            continue
        template = miniapp_templates.get(name)
        if not template:
            print(f"⚠️  Skipping {name}: not found in testnet config")
            continue
        miniapps.append((name, f"{name}.nef", f"{name}.manifest.json"))

    config.setdefault("network", "mainnet")
    config.setdefault("rpc_endpoints", ["https://mainnet1.neo.coz.io:443"])
    config.setdefault("network_magic", 860833102)
    config.setdefault("contracts", {})
    config.setdefault("miniapp_contracts", {})
    config["deployer"] = {
        "address": sender,
        "notes": "Mainnet deployer",
    }

    print("=== Neo MiniApp Platform Mainnet Deployment ===")
    print(f"RPC: {rpc}")
    print(f"Deployer: {sender}")

    for name, nef_name, manifest_name in platform_contracts:
        nef = BUILD_DIR / nef_name
        manifest = BUILD_DIR / manifest_name
        if not nef.exists() or not manifest.exists():
            print(f"  ⚠️  {name}: build artifacts missing, skipping")
            continue

        print(f"\n--- Deploying {name} ---")
        contract_hash = calc_hash(nef, manifest, sender)
        output, tx_hash = deploy(nef, manifest, rpc)
        print(output)
        entry = dict(platform_templates.get(name) or {})
        entry.update(
            {
                "name": entry.get("name") or name,
                "address": contract_hash,
                "network": "mainnet",
                "status": "deployed",
                "deployed_at": now_iso(),
            }
        )
        if tx_hash:
            entry["tx_hash"] = tx_hash
        config["contracts"][name] = entry
        config["updated_at"] = now_iso()
        write_json(CONFIG_PATH, config)

    for name, nef_name, manifest_name in miniapps:
        nef = BUILD_DIR / nef_name
        manifest = BUILD_DIR / manifest_name
        if not nef.exists() or not manifest.exists():
            print(f"  ⚠️  {name}: build artifacts missing, skipping")
            continue

        print(f"\n--- Deploying {name} ---")
        contract_hash = calc_hash(nef, manifest, sender)
        output, tx_hash = deploy(nef, manifest, rpc)
        print(output)
        entry = dict(miniapp_templates.get(name) or {})
        entry.update(
            {
                "name": entry.get("name") or name,
                "address": contract_hash,
                "network": "mainnet",
                "status": "deployed",
                "deployed_at": now_iso(),
            }
        )
        if tx_hash:
            entry["tx_hash"] = tx_hash
        config["miniapp_contracts"][name] = entry
        config["updated_at"] = now_iso()
        write_json(CONFIG_PATH, config)

    print("\n=== Mainnet deployment complete ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\n❌ Deployment failed: {exc}")
        sys.exit(1)
