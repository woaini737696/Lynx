from PIL import Image

img = Image.open('d:/Lynn工作空间/LynnHub/public/lynx-logo-black.png').convert('RGBA')
data = img.getdata()
new = []
for r, g, b, a in data:
    # 黑色背景变透明，猞猁统一为纯白色
    if r < 30 and g < 30 and b < 30:
        new.append((255, 255, 255, 0))
    else:
        new.append((255, 255, 255, a))
img.putdata(new)
img.save('d:/Lynn工作空间/LynnHub/public/lynx-logo-white.png')
print('saved lynx-logo-white.png')
