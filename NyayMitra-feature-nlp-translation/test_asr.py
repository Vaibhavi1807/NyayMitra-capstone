import sys
import tempfile
import torch
import torchaudio
from transformers import AutoModel

MODEL_NAME = "ai4bharat/indic-conformer-600m-multilingual"
TARGET_SR = 16000

print("Loading ASR model (this can take a while on first run)...")
model = AutoModel.from_pretrained(MODEL_NAME, trust_remote_code=True)
model.eval()
print("Model loaded.\n")


def run_asr(audio_path: str, lang: str, decoding: str = "ctc") -> str:
    wav, sr = torchaudio.load(audio_path)
    wav = torch.mean(wav, dim=0, keepdim=True)

    if sr != TARGET_SR:
        resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=TARGET_SR)
        wav = resampler(wav)

    with torch.no_grad():
        transcription = model(wav, lang, decoding)

    return transcription


def transcribe_and_discard(audio_bytes: bytes, lang: str, decoding: str = "ctc") -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        text = run_asr(tmp.name, lang, decoding)
    return text


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_asr.py <audio_file> <lang_code (hi/mr)>")
        sys.exit(1)

    audio_path = sys.argv[1]
    lang = sys.argv[2]

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    print(f"Transcribing {audio_path} (lang={lang}) via secure temp-file path...\n")
    result = transcribe_and_discard(audio_bytes, lang)

    print("----- TRANSCRIPTION -----")
    print(result)
    print("--------------------------")
