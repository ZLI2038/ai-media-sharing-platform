"""Generate decodable media with exact boundary sizes using legal padding chunks."""
from pathlib import Path
from PIL import Image
import io, json, struct, subprocess, zlib

workspace = Path(__file__).resolve().parents[2]
folder = workspace / '.bench/fixtures'
folder.mkdir(parents=True, exist_ok=True)
buf = io.BytesIO()
Image.new('RGB', (16, 16), (40, 80, 120)).save(buf, format='PNG')
base_png = buf.getvalue()
base_video = folder / 'base.mp4'
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                'color=c=blue:s=16x16:r=2:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart', str(base_video)], check=True)
base_mp4 = base_video.read_bytes()
fixtures = []
for mime, ext, base in [('image/png', 'png', base_png), ('video/mp4', 'mp4', base_mp4)]:
    for size in [25*1024*1024-1, 25*1024*1024, 25*1024*1024+1]:
        if ext == 'png':
            payload = bytes(size-len(base)-12)
            chunk_type = b'npAD'  # private ancillary PNG chunk; safely ignored by decoders
            chunk = struct.pack('>I', len(payload)) + chunk_type + payload + struct.pack('>I', zlib.crc32(chunk_type+payload))
            data = base[:-12] + chunk + base[-12:]
        else:
            padding = size-len(base)
            data = base + struct.pack('>I', padding) + b'free' + bytes(padding-8)
        assert len(data) == size
        dest = folder / f'{size}.{ext}'
        dest.write_bytes(data)
        if ext == 'png':
            with Image.open(dest) as image:
                image.verify()
            with Image.open(dest) as image:
                image.load()
                assert image.size == (16, 16)
        else:
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(dest), '-f', 'null', '-'], check=True, capture_output=True)
        fixtures.append({'mime': mime, 'size': size, 'path': str(dest), 'decodeVerified': True})
(folder / 'manifest.json').write_text(json.dumps(fixtures, indent=2))
print('Generated and decoded', len(fixtures), 'valid PNG/MP4 fixtures.')
