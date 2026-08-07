NTAI registration
=================

Version manifests
-----------------

- manifest.json            : v2.7.2 Official
- manifest_2.8.json        : v2.8 Official

Register an NTAI only in the manifest for the ruleset it was built for.
Do not mix v2.7.2 engines into the v2.8 manifest unless that engine has been explicitly updated and tested for v2.8.

Model files may remain under ai/models/<provider>/. The manifest controls which ruleset exposes them.

Example model entry:

{
  "id": "gpt-alpha-2.8-v1",
  "name": "GPT Alpha",
  "version": "2.8 / v1",
  "latest": true,
  "type": "ntai",
  "file": "ai/models/GPT/GPT_Alpha_2.8_v1.ntai"
}

Place newer models above older models inside each group's models array.
The current external model set in manifest.json is for v2.7.2.
