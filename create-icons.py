from PIL import Image
from pathlib import Path

logo_path = Path("assets/logo.png")
icons_dir = Path("icons")

icons_dir.mkdir(exist_ok=True)

logo = Image.open(logo_path).convert("RGBA")


def create_icon(filename, size, padding_ratio):
    # Create solid background
    canvas = Image.new("RGBA", (size, size), "white")

    # Maximum logo size
    max_logo_size = int(size * padding_ratio)

    # Keep aspect ratio
    resized = logo.copy()
    resized.thumbnail((max_logo_size, max_logo_size), Image.Resampling.LANCZOS)

    # Center logo
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2

    canvas.alpha_composite(resized, (x, y))

    # Save
    canvas.convert("RGB").save(
        icons_dir / filename,
        "PNG",
        optimize=True
    )


# Normal PWA icons
create_icon("icon-192.png", 192, 0.90)
create_icon("icon-512.png", 512, 0.90)

# Maskable icon — more padding
create_icon("maskable-icon-512.png", 512, 0.70)

print("Icons created successfully!")