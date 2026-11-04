#!/usr/bin/env python3
"""Capture a country-by-country GIF using agent-browser and ffmpeg.
Preview server must already be running. No Python packages required.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8044/maps/04-travel-clusters/')
parser.add_argument('--output', type=Path, default=ROOT / 'maps/04-travel-clusters/exports/country-tour.gif')
args = parser.parse_args()
session = subprocess.check_output(['agent-browser', 'session', 'id', '--scope', 'worktree', '--prefix', 'travel-gif'], cwd=ROOT, text=True).strip()
env = {**os.environ, 'AGENT_BROWSER_SESSION': session}

def browser(*command, code=None):
    result = subprocess.run(['agent-browser', *command], input=code, text=True, env=env, cwd=ROOT, capture_output=True, check=True)
    return result.stdout

setup = r"""
(() => {
  document.documentElement.dataset.theme = 'light';
  const panel = document.querySelector('.layout');
  const wrapper = document.createElement('section');
  wrapper.id = 'gif-export';
  wrapper.style.cssText = 'width:1280px;box-sizing:border-box;padding:22px 26px;background:#fafafa;color:#22272a;font:14px/1.5 system-ui,sans-serif;';
  const heading = document.createElement('h1');
  heading.id = 'gif-country';
  heading.style.cssText = 'font:600 26px/1.3 system-ui,sans-serif;margin:0 0 7px;';
  const subtitle = document.createElement('p');
  subtitle.textContent = '2024 · Overnight stays by residence country · Accent = selected origin · Grey = all other origins';
  subtitle.style.cssText = 'margin:0 0 14px;font-size:14px;';
  panel.style.cssText = '--panel-height:620px;grid-template-columns:minmax(0,1fr) 280px;font-family:system-ui,sans-serif;';
  wrapper.append(heading, subtitle, panel);
  const footer = document.createElement('p');
  footer.textContent = 'Domestic stays excluded · Connections are schematic, not observed routes · TourMIS / CityDNA 2024; GeoNames; Natural Earth · #30DayMapChallenge';
  footer.style.cssText = 'margin:14px 0 0;font-size:12px;max-width:none;';
  wrapper.append(footer);
  document.body.replaceChildren(wrapper);
  const style = document.createElement('style');
  style.textContent = '#gif-export .map-note {display:none} #gif-export aside h2 {font:600 19px/1.4 system-ui,sans-serif} #gif-export #selection {font:13px/1.5 system-ui,sans-serif;max-height:64px} #gif-export #ranking {font:14px/1.5 system-ui,sans-serif;scrollbar-width:none} #gif-export #ranking button {font:inherit} #gif-export #ranking small {font-size:12px}';
  document.head.append(style);
  return 'export wrapper ready';
})()
"""
# Save control references before replacing the body; the renderer keeps its own
# references and still handles dispatched changes on these detached controls.
retain_controls = "window.gifOrigin=document.querySelector('#origin');window.gifDomestic=document.querySelector('#exclude-domestic');window.gifFlows=document.querySelector('#show-flows');window.gifCountries=Array.from(gifOrigin.options,o=>o.value);gifDomestic.checked=true;gifFlows.checked=true;gifDomestic.dispatchEvent(new Event('change')); 'controls retained';"
args.output.parent.mkdir(parents=True, exist_ok=True)
try:
    browser('set', 'viewport', '1280', '850')
    browser('open', args.url)
    browser('wait', '--fn', "document.querySelector('#map').dataset.settled === 'true'")
    browser('eval', '--stdin', code=retain_controls)
    countries = json.loads(browser('eval', '--stdin', code='JSON.stringify(window.gifCountries)'))
    # agent-browser serializes a returned JS string as JSON; decode its contents.
    if isinstance(countries, str):
        countries = json.loads(countries)
    browser('eval', '--stdin', code=setup)
    with tempfile.TemporaryDirectory(prefix='travel-gif-') as frames:
        for i, country in enumerate(countries):
            code = f"gifOrigin.value={json.dumps(country)};gifOrigin.dispatchEvent(new Event('change'));document.querySelector('#gif-country').textContent={json.dumps(f'{country} · {i+1:02d}/{len(countries)}')};document.querySelector('#ranking').scrollTop=0;document.querySelector('#selection').textContent=document.querySelectorAll('.dot.selected').length+' destinations · Person-nights. Top destinations shown below.'; 'frame ready';"
            browser('eval', '--stdin', code=code)
            browser('screenshot', '#gif-export', str(Path(frames) / f'frame-{i:03d}.png'))
            print(f'[{i+1}/{len(countries)}] {country}', flush=True)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-framerate', '5/6',
                        '-i', str(Path(frames) / 'frame-%03d.png'), '-filter_complex',
                        '[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
                        '-loop', '0', str(args.output)], check=True)
    print(f'GIF: {args.output} ({args.output.stat().st_size:,} bytes)')
finally:
    browser('close')
