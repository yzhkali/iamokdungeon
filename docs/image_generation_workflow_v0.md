# Image Generation Workflow v0 - I’m OK Dungeon

## Purpose

This project uses Codex custom API configuration for image generation. Future Codex conversations working on **I’m OK Dungeon / 没事地下城** should follow this workflow instead of looking for the built-in image generation tool first.

## Required Rule

Do **not** call:

- `https://api.openai.com/v1/images/generations`

Always read the Codex custom provider config and call the configured `base_url` instead.

Current working endpoint discovered from this machine:

- `https://www.codexauv.com/v1/images/generations`

But future conversations should still read `config.toml` instead of hard-coding this URL.

## Config Files

Read:

- `C:\Users\Windows\.codex\config.toml`
- `C:\Users\Windows\.codex\auth.json`

From `config.toml`:

1. Read the active provider name from:

```toml
model_provider = "OpenAI"
```

2. Find that provider block:

```toml
[model_providers.OpenAI]
base_url = "https://www.codexauv.com"
requires_openai_auth = true
```

3. Build the image generation URL:

```text
{base_url}/v1/images/generations
```

From `auth.json`:

```json
{
  "OPENAI_API_KEY": "..."
}
```

Use `OPENAI_API_KEY` only in the Authorization header. Never print it, log it, or write it into project files.

## Request Format

Use `POST {base_url}/v1/images/generations`.

Typical request body:

```json
{
  "model": "gpt-image-2",
  "prompt": "...",
  "size": "1024x1024",
  "quality": "low",
  "n": 1,
  "output_format": "png"
}
```

For faster drafts, use:

```text
quality = low
```

For more polished final concepts, try:

```text
quality = medium
```

If a request times out with `524`, retry with a shorter prompt and/or lower quality. Complex sprite sheets may time out; generate a single character/asset first, then expand.

## Response Handling

The image is returned as base64 in:

```text
response.data[0].b64_json
```

Decode it and save as PNG.

## PowerShell Template

```powershell
$configPath = 'C:\Users\Windows\.codex\config.toml'
$authPath = 'C:\Users\Windows\.codex\auth.json'

$config = Get-Content -LiteralPath $configPath -Raw
$currentProviderMatch = [regex]::Match($config, '(?m)^model_provider\s*=\s*"([^"]+)"')
$providerName = if ($currentProviderMatch.Success) { $currentProviderMatch.Groups[1].Value } else { 'OpenAI' }
$providerPattern = '(?ms)^\[model_providers\.' + [regex]::Escape($providerName) + '\]\s*(.*?)(?=^\[|\z)'
$providerBlock = [regex]::Match($config, $providerPattern)
$baseUrl = ([regex]::Match($providerBlock.Groups[1].Value, 'base_url\s*=\s*"([^"]+)"')).Groups[1].Value.TrimEnd('/')
$uri = "${baseUrl}/v1/images/generations"
if ($uri -eq 'https://api.openai.com/v1/images/generations') { throw 'Refusing to call api.openai.com; expected custom Codex base_url.' }

$auth = Get-Content -LiteralPath $authPath -Raw | ConvertFrom-Json
$key = $auth.OPENAI_API_KEY

$body = @{
  model = 'gpt-image-2'
  prompt = '<prompt here>'
  size = '1024x1024'
  quality = 'low'
  n = 1
  output_format = 'png'
} | ConvertTo-Json -Depth 8

$response = Invoke-RestMethod -Method Post -Uri $uri -Headers @{
  Authorization = "Bearer $key"
  'Content-Type' = 'application/json'
} -Body $body -TimeoutSec 360

[IO.File]::WriteAllBytes('<output path>.png', [Convert]::FromBase64String($response.data[0].b64_json))
```

## Project Output Convention

Save project image outputs under:

- `D:\I’m OK Dungeon\assets\concepts\` for concept art
- `D:\I’m OK Dungeon\assets\sprites\` for sprite sheets or in-game sprites
- `D:\I’m OK Dungeon\assets\vfx\` for effects
- `D:\I’m OK Dungeon\assets\ui\` for UI icons and panels
- `D:\I’m OK Dungeon\assets\environments\` for scene/room art

Also save the exact prompt next to the generated image as a `.txt` file.

## Confirmed Working Example

This workflow successfully generated:

- `D:\I’m OK Dungeon\assets\concepts\honest_man_front_iso_concept_v0.png`

Prompt saved at:

- `D:\I’m OK Dungeon\assets\concepts\honest_man_front_iso_concept_v0_prompt.txt`
