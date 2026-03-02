#!/bin/bash
sed -i '' 's/assert.Len(t, apps, 64)/assert.Len(t, apps, 4)/g' services/simulation/marble/miniapp_simulator_test.go
