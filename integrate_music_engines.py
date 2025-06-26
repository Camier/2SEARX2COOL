#!/usr/bin/env python3
"""
Integrate custom music engines into SearXNG
Adds engine configurations and ensures proper setup
"""

import yaml
import shutil
from pathlib import Path
import sys

def add_music_engines_to_config():
    """Add custom music engines to SearXNG settings"""
    
    config_path = Path("/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml")
    
    # Backup current config
    backup_path = config_path.with_suffix('.yml.backup')
    shutil.copy(config_path, backup_path)
    print(f"✅ Backed up config to {backup_path}")
    
    # Load current config
    with open(config_path) as f:
        config = yaml.safe_load(f)
    
    # Ensure engines section exists
    if 'engines' not in config:
        config['engines'] = []
    
    # Define custom music engines with safe initial config
    custom_engines = [
        # Start with a few well-tested engines
        {
            'name': 'beatport',
            'engine': 'beatport_adapted',
            'shortcut': 'bp',
            'categories': 'music',
            'disabled': False,
            'weight': 1
        },
        {
            'name': 'discogs_music', 
            'engine': 'discogs_music_adapted',
            'shortcut': 'disc',
            'categories': 'music',
            'disabled': False,
            'weight': 1
        },
        {
            'name': 'lastfm',
            'engine': 'lastfm_adapted',
            'shortcut': 'lfm',
            'categories': 'music', 
            'disabled': False,
            'weight': 1
        },
        {
            'name': 'musicbrainz',
            'engine': 'musicbrainz_adapted',
            'shortcut': 'mb',
            'categories': 'music',
            'disabled': False,
            'weight': 1
        },
        # Initially disable potentially problematic engines
        {
            'name': 'spotify_web',
            'engine': 'spotify_web_adapted',
            'shortcut': 'spfy',
            'categories': 'music',
            'disabled': True,  # Disabled initially
            'weight': 1
        },
        {
            'name': 'apple_music_web',
            'engine': 'apple_music_web_adapted',
            'shortcut': 'apmu',
            'categories': 'music',
            'disabled': True,  # Disabled initially
            'weight': 1
        }
    ]
    
    # Remove any existing custom engines to avoid duplicates
    existing_names = {e['name'] for e in custom_engines}
    config['engines'] = [e for e in config['engines'] if e.get('name') not in existing_names]
    
    # Add custom engines
    config['engines'].extend(custom_engines)
    
    # Save updated config
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    print(f"✅ Added {len(custom_engines)} music engines to configuration")
    print(f"   - Enabled: {len([e for e in custom_engines if not e.get('disabled', False)])}")
    print(f"   - Disabled: {len([e for e in custom_engines if e.get('disabled', False)])}")
    
    return True


def copy_adapted_engines():
    """Copy adapted engines to SearXNG engines directory"""
    
    adapted_dir = Path("/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/adapted_engines")
    target_dir = Path("/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-core/searxng-core/searx/engines")
    
    if not target_dir.exists():
        print(f"❌ Target directory not found: {target_dir}")
        return False
    
    copied = 0
    for engine_file in adapted_dir.glob("*_adapted.py"):
        target_file = target_dir / engine_file.name
        shutil.copy(engine_file, target_file)
        copied += 1
        print(f"✅ Copied {engine_file.name}")
    
    print(f"\n📁 Copied {copied} adapted engines to SearXNG")
    return True


def verify_engine_imports():
    """Verify that adapted engines can be imported"""
    
    engine_dir = Path("/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/searxng-core/searxng-core/searx/engines")
    sys.path.insert(0, str(engine_dir))
    
    engines_to_test = [
        'beatport_adapted',
        'discogs_music_adapted',
        'lastfm_adapted',
        'musicbrainz_adapted'
    ]
    
    results = []
    for engine_name in engines_to_test:
        try:
            module = __import__(engine_name)
            if hasattr(module, 'request') and hasattr(module, 'response'):
                results.append((engine_name, "✅ Valid"))
            else:
                results.append((engine_name, "⚠️  Missing functions"))
        except Exception as e:
            results.append((engine_name, f"❌ Import error: {e}"))
    
    print("\n🔍 Engine Import Verification:")
    for name, status in results:
        print(f"   {name}: {status}")
    
    return all("✅" in status for _, status in results)


def main():
    """Main integration process"""
    print("🎵 Integrating Custom Music Engines into SearXNG")
    print("=" * 60)
    
    # Step 1: Copy adapted engines
    if not copy_adapted_engines():
        print("❌ Failed to copy engines")
        return 1
    
    # Step 2: Verify imports
    if not verify_engine_imports():
        print("⚠️  Some engines have import issues")
        # Continue anyway - we'll test them live
    
    # Step 3: Update configuration
    if not add_music_engines_to_config():
        print("❌ Failed to update configuration")
        return 1
    
    print("\n✅ Integration complete!")
    print("\n📝 Next steps:")
    print("   1. Restart SearXNG: pkill -f 'searx.webapp' && ./start-fixed.sh")
    print("   2. Run parallel tests: python parallel_engine_tester.py")
    print("   3. Check logs: tail -f /tmp/searxng.log")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())