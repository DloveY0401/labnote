from PIL import Image
import os

img1_path = r"C:\Users\12629\Desktop\【哲风壁纸】一二布布-卡通-可爱.png"
img2_path = r"C:\Users\12629\Desktop\【哲风壁纸】一二布布-云朵-卡通.png"
output_dir = r"E:\labnote\public\widget-bears"
os.makedirs(output_dir, exist_ok=True)

# Process first image: brown bear on left, white bear on right
img1 = Image.open(img1_path).convert("RGBA")
w1, h1 = img1.size
# Crop bottom half where bears are
bottom1 = img1.crop((0, h1 * 0.45, w1, h1))
bw1, bh1 = bottom1.size
# Left half: brown bear
brown_bear = bottom1.crop((0, 0, bw1 * 0.5, bh1))
# Right half: white bear
white_bear = bottom1.crop((bw1 * 0.5, 0, bw1, bh1))

brown_bear.save(os.path.join(output_dir, "brown-bear.png"))
white_bear.save(os.path.join(output_dir, "white-bear.png"))

# Process second image as alternative poses
img2 = Image.open(img2_path).convert("RGBA")
w2, h2 = img2.size
# Crop the middle region
mid2 = img2.crop((w2 * 0.1, h2 * 0.25, w2 * 0.9, h2 * 0.85))
bw2, bh2 = mid2.size
# Left side: white bear
alt_white = mid2.crop((0, 0, bw2 * 0.45, bh2))
# Right side: brown bear
alt_brown = mid2.crop((bw2 * 0.55, 0, bw2, bh2))

alt_white.save(os.path.join(output_dir, "white-bear-alt.png"))
alt_brown.save(os.path.join(output_dir, "brown-bear-alt.png"))

print("Bear images extracted to", output_dir)
print("Files:", os.listdir(output_dir))
