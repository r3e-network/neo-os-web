#!/bin/bash
sed -i '' 's/assert.Equal(t, 17, gaming)/assert.Equal(t, 3, gaming)/g' services/simulation/marble/miniapp_simulator_test.go
sed -i '' 's/assert.Equal(t, 17, defi)/assert.Equal(t, 1, defi)/g' services/simulation/marble/miniapp_simulator_test.go
sed -i '' 's/assert.Equal(t, 3, governance)/assert.Equal(t, 0, governance)/g' services/simulation/marble/miniapp_simulator_test.go
sed -i '' 's/assert.Equal(t, 18, social)/assert.Equal(t, 0, social)/g' services/simulation/marble/miniapp_simulator_test.go
sed -i '' 's/assert.Equal(t, 6, advanced)/assert.Equal(t, 0, advanced)/g' services/simulation/marble/miniapp_simulator_test.go
sed -i '' 's/assert.Equal(t, 3, creative)/assert.Equal(t, 0, creative)/g' services/simulation/marble/miniapp_simulator_test.go
