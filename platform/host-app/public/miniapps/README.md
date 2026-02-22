# Legacy Static MiniApps

This directory previously held exported static MiniApp bundles.

Current runtime policy is manifest-driven:

- MiniApps are described by JSON/YAML/Markdown specs
- Host renders from manifest schema/template metadata
- Built-ins use `mf://manifest?app=<app_id>` entry URLs

Do not add new static bundles here.
