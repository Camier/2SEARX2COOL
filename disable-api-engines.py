#!/usr/bin/env python3
"""
Disable engines that require API keys
"""

import yaml

def disable_api_engines():
    settings_path = "/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml"
    
    # Read current settings
    with open(settings_path, 'r') as f:
        settings = yaml.safe_load(f)
    
    engines = settings.get('engines', [])
    
    # Engines that require API keys
    engines_to_disable = ['jamendo', 'spotify']
    
    # Disable these engines
    disabled_count = 0
    for engine in engines:
        name = engine.get('name')
        if name in engines_to_disable:
            engine['disabled'] = True
            disabled_count += 1
            print(f"✅ Disabled {name} (requires API key)")
    
    # Write back
    with open(settings_path, 'w') as f:
        yaml.dump(settings, f, default_flow_style=False, sort_keys=False)
    
    print(f"\n🎉 Disabled {disabled_count} engines that require API keys")

if __name__ == "__main__":
    disable_api_engines()