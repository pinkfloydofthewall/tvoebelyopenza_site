import os
import sys
import json

try:
    from PIL import Image
except ImportError:
    print("Ошибка: Библиотека Pillow не установлена. Запустите: pip install Pillow")
    sys.exit(1)

IMAGE_DIR = 'images'
MAX_SIZE = 600  # More aggressive size for product grid

def compress_images():
    count = 0
    saved_bytes = 0
    
    for filename in os.listdir(IMAGE_DIR):
        if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
            
        # Skip hero image to preserve high quality
        if filename == 'A_wide-angle_professional_photography_of_202606230213.jpeg' or filename == 'placeholder.png' or filename == 'logo.jpg':
            continue

        filepath = os.path.join(IMAGE_DIR, filename)
        original_size = os.path.getsize(filepath)
        
        try:
            with Image.open(filepath) as img:
                # Convert RGBA/P to RGB for JPEG compatibility
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Aggressive resize
                img.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
                
                if filename.lower().endswith('.png'):
                    new_filename = filename[:-4] + '.jpg'
                    new_filepath = os.path.join(IMAGE_DIR, new_filename)
                    # Save as JPG
                    img.save(new_filepath, 'JPEG', optimize=True, quality=70)
                    os.remove(filepath)
                    filepath = new_filepath
                else:
                    img.save(filepath, 'JPEG', optimize=True, quality=70)
                    
            new_size = os.path.getsize(filepath)
            saved = original_size - new_size
            if saved > 0:
                saved_bytes += saved
                count += 1
                print(f"Сжато: {filename} ({original_size // 1024} KB -> {new_size // 1024} KB)")
        except Exception as e:
            print(f"Ошибка при обработке {filename}: {e}")
            
    print(f"\nГотово! Успешно сжато картинок: {count}.")
    print(f"Сэкономлено места: {saved_bytes // (1024*1024)} МБ.")

    # Update data.json to point to new .jpg files instead of .png
    try:
        with open('data.json', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # We only replace .png" with .jpg" to avoid replacing placeholder.png which wasn't converted
        # Actually placeholder is just in script.js. But let's just do .png to .jpg globally in data.json.
        content = content.replace('.png"', '.jpg"')
        
        with open('data.json', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Обновлен data.json (.png -> .jpg)")
    except Exception as e:
        print("Ошибка при обновлении data.json:", e)

if __name__ == "__main__":
    print("Начинаю жесткое сжатие изображений...")
    compress_images()
