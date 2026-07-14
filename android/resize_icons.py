import os
import shutil
from PIL import Image

# Path to generated icon
source_path = r"C:\Users\Admin\.gemini\antigravity-ide\brain\567ac039-3727-4e9b-9f3d-e22debaa4fc4\cine3d_logo_1784036357318.png"

# Target directories
res_dir = r"d:\code\du_an\webxemphim\android\app\src\main\res"

sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

# Remove adaptive icons folder so Android falls back to our high-quality static webp launcher files
anydpi_dir = os.path.join(res_dir, "mipmap-anydpi-v26")
if os.path.exists(anydpi_dir):
    shutil.rmtree(anydpi_dir)
    print(f"Removed adaptive icons folder: {anydpi_dir}")

img = Image.open(source_path)

for folder, size in sizes.items():
    folder_path = os.path.join(res_dir, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # Save standard ic_launcher.webp
    icon_img = img.resize((size, size), Image.Resampling.LANCZOS)
    icon_path = os.path.join(folder_path, "ic_launcher.webp")
    icon_img.save(icon_path, "WEBP", quality=90)
    print(f"Saved: {icon_path}")
    
    # Save round ic_launcher_round.webp
    round_path = os.path.join(folder_path, "ic_launcher_round.webp")
    icon_img.save(round_path, "WEBP", quality=90)
    print(f"Saved: {round_path}")

print("Icon resizing complete!")
