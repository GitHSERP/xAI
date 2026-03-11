from pathlib import Path
import tkinter as tk


INPUT_PATH = Path("brand-header.png")
OUTPUT_PATH = Path("brand-header-optimized.png")

TARGET_RATIO = 3.7
BASE_PADDING_X = 14
BASE_PADDING_Y = 10
LEFT_EXTRA = 4
RIGHT_EXTRA = 16


def is_visible(pixel):
    if isinstance(pixel, str):
        pixel = pixel.strip()
        if not pixel:
            return False
        if pixel.startswith("#") and len(pixel) == 7:
            r = int(pixel[1:3], 16)
            g = int(pixel[3:5], 16)
            b = int(pixel[5:7], 16)
            return not (r > 245 and g > 245 and b > 245)
        return True

    r, g, b = pixel[:3]
    return not (r > 245 and g > 245 and b > 245)


def find_visible_bounds(image):
    width = image.width()
    height = image.height()
    min_x, min_y = width, height
    max_x, max_y = -1, -1

    for y in range(height):
        for x in range(width):
            if not is_visible(image.get(x, y)):
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < 0 or max_y < 0:
        raise ValueError("No visible content found in image.")

    return min_x, min_y, max_x, max_y


def clamp_crop(left, top, right, bottom, width, height):
    left = max(0, left)
    top = max(0, top)
    right = min(width, right)
    bottom = min(height, bottom)
    return left, top, right, bottom


def build_crop_box(image):
    img_w = image.width()
    img_h = image.height()
    min_x, min_y, max_x, max_y = find_visible_bounds(image)

    left = min_x - BASE_PADDING_X - LEFT_EXTRA
    right = max_x + 1 + BASE_PADDING_X + RIGHT_EXTRA
    top = min_y - BASE_PADDING_Y
    bottom = max_y + 1 + BASE_PADDING_Y

    left, top, right, bottom = clamp_crop(left, top, right, bottom, img_w, img_h)

    crop_w = right - left
    crop_h = bottom - top
    current_ratio = crop_w / crop_h

    if current_ratio < TARGET_RATIO:
        desired_width = int(round(crop_h * TARGET_RATIO))
        extra_width = desired_width - crop_w
        left -= extra_width // 2
        right += extra_width - (extra_width // 2)
    else:
        desired_height = int(round(crop_w / TARGET_RATIO))
        extra_height = desired_height - crop_h
        top -= extra_height // 2
        bottom += extra_height - (extra_height // 2)

    return clamp_crop(left, top, right, bottom, img_w, img_h)


def main():
    root = tk.Tk()
    root.withdraw()

    source = tk.PhotoImage(file=str(INPUT_PATH))
    left, top, right, bottom = build_crop_box(source)
    width = right - left
    height = bottom - top

    cropped = tk.PhotoImage(width=width, height=height)
    cropped.tk.call(
        cropped,
        "copy",
        source,
        "-from",
        left,
        top,
        right,
        bottom,
        "-to",
        0,
        0,
    )
    cropped.write(str(OUTPUT_PATH), format="png")

    print(f"saved {OUTPUT_PATH} -> {width}x{height}")
    print(f"ratio {width / height:.3f}:1")

    root.destroy()


if __name__ == "__main__":
    main()
