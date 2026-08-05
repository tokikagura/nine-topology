NTAI registration
=================

1. Put the .ntai file in this ai/ folder.
2. Add one model entry to manifest.json.
3. Do not edit index.html.

Example model entry:

{
  "id": "gpt-alpha-v8",
  "name": "GPT Alpha v8",
  "version": "v8",
  "latest": true,
  "type": "ntai",
  "file": "ai/gpt-alpha-v8.ntai"
}

Place newer models above older models inside each group's models array.
Only models compatible with ruleVersion 2.7.2 should be registered here.
