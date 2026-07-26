//go:build scripts

package main

import "testing"

func TestPlatformRegistryRegistrationMethodRespectsReservedNamespace(t *testing.T) {
	if !prIsPlatformOwnedAppID("miniapp-new-game") {
		t.Fatal("miniapp-* must be classified as platform-owned")
	}
	if prRegistrationMethod("miniapp-new-game") != "registerAppByPlatform" {
		t.Fatal("platform-owned ids must use registerAppByPlatform")
	}
	if prIsPlatformOwnedAppID("community-game") {
		t.Fatal("custom ids must remain permissionless")
	}
	if prRegistrationMethod("community-game") != "registerApp" {
		t.Fatal("custom ids must use registerApp")
	}
}
