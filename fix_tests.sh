#!/bin/bash
sed -i 's/NewClient(Config{URL: ts.URL, ServiceKey: "test-key"})/NewClient(Config{URL: ts.URL, ServiceKey: "test-key", AllowInsecure: true})/g' infrastructure/database/supabase_test.go
