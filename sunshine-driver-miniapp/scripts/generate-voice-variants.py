import asyncio
import os
from pathlib import Path

try:
    import edge_tts
except ImportError as error:
    raise SystemExit(
        "edge-tts is required to generate realistic voice assets. "
        "Install it with: py -3 -m pip install edge-tts"
    ) from error


ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "audio"
VOICE_ROOT = AUDIO_DIR / "voices"

AUDIO_TEXTS = {
    "driver-auto-accept": "已自动接单，请按导航前往乘客上车点。",
    "driver-carpool-order": "有新的顺风车订单，请及时查看并接单。",
    "driver-destination-500": "距离目的地还有五百米，请提醒乘客带好随身物品。",
    "driver-onboard-reminder": "请提醒乘客系好安全带，并确认目的地。",
    "driver-passenger-cancel": "乘客已取消订单，请留意新的订单。",
    "driver-passenger-onboard": "乘客已上车，请开始行程。",
    "driver-pickup-500": "距离上车点还有五百米，请准备接乘客。",
}

VOICE_STYLES = {
    "default": {
        "voice": "zh-CN-YunyangNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "volume": "+0%",
    },
    "gentle-female": {
        "voice": "zh-CN-XiaoxiaoNeural",
        "rate": "-2%",
        "pitch": "-1Hz",
        "volume": "+0%",
    },
    "sunny-energetic": {
        "voice": "zh-CN-YunxiNeural",
        "rate": "+3%",
        "pitch": "+2Hz",
        "volume": "+0%",
    },
    "mature-man": {
        "voice": "zh-CN-YunyangNeural",
        "rate": "-6%",
        "pitch": "-8Hz",
        "volume": "+0%",
    },
    "playful": {
        "voice": "zh-CN-YunxiaNeural",
        "rate": "+5%",
        "pitch": "+3Hz",
        "volume": "+0%",
    },
}


def iter_audio_keys():
    for source_path in sorted(AUDIO_DIR.glob("*.wav")):
        yield source_path.stem


async def generate_clip(style_name, options, audio_key):
    text = AUDIO_TEXTS.get(audio_key)
    if not text:
        raise ValueError(f"missing prompt for audio key: {audio_key}")

    target_dir = VOICE_ROOT / style_name
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{audio_key}.mp3"
    temp_path = target_dir / f"{audio_key}.tmp.mp3"

    for attempt in range(3):
        if temp_path.exists():
            temp_path.unlink()
        communicate = edge_tts.Communicate(
            text=text,
            voice=options["voice"],
            rate=options["rate"],
            pitch=options["pitch"],
            volume=options["volume"],
        )
        try:
            await communicate.save(str(temp_path))
            if temp_path.stat().st_size <= 0:
                raise RuntimeError(f"empty generated audio: {temp_path}")
            temp_path.replace(target_path)
            break
        except Exception:
            if attempt >= 2:
                raise
            await asyncio.sleep(1 + attempt)
    return target_path


async def main():
    audio_keys = list(iter_audio_keys())
    for style_name, options in VOICE_STYLES.items():
        generated = []
        for audio_key in audio_keys:
            generated.append(await generate_clip(style_name, options, audio_key))
        print(f"generated {style_name}: {len(generated)} mp3 files")


if __name__ == "__main__":
    os.chdir(ROOT)
    asyncio.run(main())
