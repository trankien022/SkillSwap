#!/usr/bin/env python3
"""Bounded, device-specific controls for the dedicated SkillSwap Android AVD."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
SDK = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library/Android/sdk'))
ADB = str(SDK / 'platform-tools/adb')
AVD = 'SkillSwap_AI_API35'
SERIAL = 'emulator-5580'
OUT = ROOT / 'artifacts/ai-simulator'
ENV = dict(os.environ, ANDROID_HOME=str(SDK), ANDROID_SDK_ROOT=str(SDK),
           MAESTRO_CLI_NO_ANALYTICS='1', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED='true')


def run(args, timeout=20, check=True):
    return subprocess.run([str(x) for x in args], env=ENV, capture_output=True,
                          text=True, timeout=timeout, check=check)


def adb(*args, timeout=20, check=True):
    return run([ADB, '-s', SERIAL, *args], timeout, check)


def owned():
    result = adb('emu', 'avd', 'name', check=False)
    if result.returncode or result.stdout.splitlines()[0:1] != [AVD]:
        raise RuntimeError(f'{SERIAL} is not the running {AVD}; run up first.')


def health(url):
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return {'status': response.status}
    except Exception as error:
        return {'error': str(error)}


def up():
    devices = run([ADB, 'devices']).stdout
    if SERIAL not in devices:
        available = run([SDK / 'emulator/emulator', '-list-avds']).stdout.splitlines()
        if AVD not in available:
            raise RuntimeError(f'Missing {AVD}; follow docs/runbooks/ai-simulator.md.')
        OUT.mkdir(parents=True, exist_ok=True)
        with (OUT / 'emulator.log').open('ab') as log:
            subprocess.Popen([str(SDK / 'emulator/emulator'), '-avd', AVD,
                              '-port', '5580', '-cores', '2', '-memory', '2048',
                              '-gpu', 'swiftshader', '-no-snapshot', '-no-boot-anim',
                              '-no-audio'], env=ENV, stdout=log, stderr=log,
                             start_new_session=True)
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        try:
            if adb('shell', 'getprop', 'sys.boot_completed', timeout=5, check=False).stdout.strip() == '1':
                owned()
                break
        except subprocess.TimeoutExpired:
            pass
        time.sleep(2)
    else:
        raise RuntimeError('Boot exceeded 180 seconds. Inspect artifacts/ai-simulator/emulator.log; no automatic wipe/retry.')
    for key in ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'):
        adb('shell', 'settings', 'put', 'global', key, '0')
    adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    adb('shell', 'wm', 'dismiss-keyguard')
    for port in ('4000', '8081'):
        adb('reverse', f'tcp:{port}', f'tcp:{port}')
    print(f'{AVD} ready: {SERIAL}')


def capture():
    owned()
    target = OUT / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    target.mkdir(parents=True)
    shot = subprocess.run([ADB, '-s', SERIAL, 'exec-out', 'screencap', '-p'],
                          env=ENV, capture_output=True, timeout=15, check=True)
    (target / 'screen.png').write_bytes(shot.stdout)
    adb('shell', 'uiautomator', 'dump', '/sdcard/skillswap-window.xml', timeout=30)
    adb('pull', '/sdcard/skillswap-window.xml', str(target / 'hierarchy.xml'))
    (target / 'window.txt').write_text(adb('shell', 'dumpsys', 'window').stdout)
    print(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['setup', 'up', 'doctor', 'capture', 'install', 'open', 'test', 'down'])
    parser.add_argument('file', nargs='?')
    args = parser.parse_args()
    if args.command == 'setup':
        image = SDK / 'system-images/android-35/google_apis/arm64-v8a/system.img'
        if not image.is_file():
            raise RuntimeError('Install the API 35 Google APIs ARM64 image first; see the runbook.')
        base = Path.home() / '.android/avd'
        folder = base / (AVD + '.avd')
        pointer = base / (AVD + '.ini')
        if folder.exists() or pointer.exists():
            raise RuntimeError('AVD already exists; left intact. Use up.')
        folder.mkdir(parents=True)
        shutil.copyfile(Path(__file__).with_name('ai-avd-config.ini'), folder / 'config.ini')
        pointer.write_text(f'avd.ini.encoding=UTF-8\npath={folder}\npath.rel=avd/{AVD}.avd\ntarget=android-35\n')
        print(f'Created {AVD}')
    elif args.command == 'up':
        up()
    elif args.command == 'doctor':
        owned()
        print(json.dumps({'device': SERIAL, 'avd': AVD,
                          'boot': adb('shell', 'getprop', 'sys.boot_completed').stdout.strip(),
                          'display': adb('shell', 'wm', 'size').stdout.strip(),
                          'gateway': health('http://localhost:4000/health'),
                          'metro': health('http://localhost:8081/status'),
                          'maestro': shutil.which('maestro')}, indent=2))
    elif args.command == 'capture':
        capture()
    elif args.command == 'install':
        owned()
        apk = Path(args.file) if args.file else ROOT / 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk'
        if not apk.is_file():
            raise RuntimeError(f'APK missing: {apk}')
        print(adb('install', '-r', str(apk.resolve()), timeout=120).stdout)
    elif args.command == 'open':
        owned()
        print(adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d',
                  'exp+skillswap://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081',
                  'com.skillswap.app').stdout)
    elif args.command == 'test':
        owned()
        if not args.file:
            parser.error('test requires a Maestro YAML flow path')
        result = run(['maestro', '--device', SERIAL, 'test', args.file], timeout=180, check=False)
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)
    elif args.command == 'down':
        owned()
        print(adb('emu', 'kill').stdout)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.SubprocessError, OSError) as error:
        print(f'Simulator error: {error}', file=sys.stderr)
        sys.exit(1)
